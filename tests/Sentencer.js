const anchor = require('@project-serum/anchor');
const BN = require('bn.js');
const expect = require('chai').expect;
const {SystemProgram, LAMPORTS_PER_SOL} = anchor.web3;

describe('Sentencer', () => {

    // Configure the client to use the local cluster.
    const provider = anchor.Provider.env()
    anchor.setProvider(provider);

    const mainProgram = anchor.workspace.Sentencer;

    function expectBalance(actual, expected, message, slack = 20000) {
        expect(actual, message).within(expected - slack, expected + slack)
    }

    async function createUser(airdropBalance) {
        airdropBalance = airdropBalance ?? 10 * LAMPORTS_PER_SOL;
        let user = anchor.web3.Keypair.generate();
        let sig = await provider.connection.requestAirdrop(user.publicKey, airdropBalance);
        await provider.connection.confirmTransaction(sig);

        let wallet = new anchor.Wallet(user);
        let userProvider = new anchor.Provider(provider.connection, wallet, provider.opts);

        return {
            key: user,
            wallet,
            provider: userProvider,
        };
    }

    function createUsers(numUsers) {
        let promises = [];
        for (let i = 0; i < numUsers; i++) {
            promises.push(createUser());
        }

        return Promise.all(promises);
    }

    async function getAccountBalance(pubkey) {
        let account = await provider.connection.getAccountInfo(pubkey);
        return account?.lamports ?? 0;
    }

    function programForUser(user) {
        return new anchor.Program(mainProgram.idl, mainProgram.programId, user.provider);
    }

    async function createSentence(owner, name, body) {
        const [sentenceAccount, bump] = await anchor.web3.PublicKey.findProgramAddress([
            "sentencer",
            owner.key.publicKey.toBytes(),
            name.slice(0, 32)
        ], mainProgram.programId);

        let program = programForUser(owner);
        await program.rpc.newSentence(name, body, bump, {
            accounts: {
                sentence: sentenceAccount,
                user: owner.key.publicKey,
                systemProgram: SystemProgram.programId,
            },
        });

        let sentence = await program.account.sentencer.fetch(sentenceAccount);
        return {publicKey: sentenceAccount, data: sentence};
    }

    async function listSentence(old_sentence, owner, name, price) {

        const [sentenceAccount, bump] = await anchor.web3.PublicKey.findProgramAddress([
            "sentencer",
            owner.key.publicKey.toBytes(),
            name.slice(0, 32)
        ], mainProgram.programId);

        let program = programForUser(owner);

        await program.rpc.listSentence(name,new anchor.BN(price), {
            accounts: {
                sentence: old_sentence.publicKey,
                sentenceOwner: owner.key.publicKey,
                user: owner.key.publicKey,
            },
        })

        let sentence = await program.account.sentencer.fetch(sentenceAccount);
        return {publicKey: sentenceAccount, data: sentence};
    }

    describe('new sentence', () => {
        it('creates a sentence', async () => {
            const owner = await createUser();
            let sent = await createSentence(owner, 'A sentence', 'Hello World');

            expect(sent.data.sentenceOwner.toString(), ' owner is set').equals(owner.key.publicKey.toString());
            expect(sent.data.name, ' name is set').equals('A sentence');
            expect(sent.data.body, ' has body').equals('Hello World');
            expect(sent.data.listed, 'is listed').equals(false);
            expect(sent.data.price.toString(), 'has price').equals('0')
        });
        it('lists a sentence for sale', async () => {

            const price = 5 * LAMPORTS_PER_SOL;
            const owner = await createUser();
            let sent = await createSentence(owner, 'A sentence', 'Hello World');

            expect(sent.data.sentenceOwner.toString(), ' owner is set').equals(owner.key.publicKey.toString());

            let updated = await listSentence(sent,owner, 'A sentence', price);
            expect(updated.data.listed, 'is listed').equals(true);
            expect(updated.data.price.toString(), 'has price').equals(price.toString())
        });


        //end inner describe
    });


    //end describe block
});
