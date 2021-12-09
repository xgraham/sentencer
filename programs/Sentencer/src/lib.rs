use anchor_lang::prelude::*;

declare_id!("DTRyZqwwPn4oAfKaUejPxGAJVay8c6JwYryN7okPCaBg");

#[program]
pub mod sentencer {
    use anchor_lang::solana_program::{program::invoke, system_instruction::transfer};

    use super::*;

    pub fn new_sentence(
        ctx: Context<NewSentence>,
        name: String,
        body: String,
        account_bump: u8,
    ) -> ProgramResult {
        // Create a new account
        let sentence = &mut ctx.accounts.sentence;
        sentence.sentence_owner = *ctx.accounts.user.to_account_info().key;
        sentence.bump = account_bump;
        sentence.name = name;
        sentence.body = body;
        sentence.listed = false;
        sentence.price = 0;
        Ok(())
    }

    pub fn list_sentence(
        ctx: Context<ListSentence>,
        _sentence_name: String,
        price: u64,
    ) -> ProgramResult {
        let sentence = &mut ctx.accounts.sentence;
        let user = ctx.accounts.user.to_account_info().key;
        //Check if signer is the owner
        let is_signer_owner = &sentence.sentence_owner == user;

        if is_signer_owner {
            sentence.price = price;
            sentence.listed = true;
        }
        if !is_signer_owner {
            return Err(SentError::WrongOwner.into());
        }
        Ok(())
    }
}


#[account]
pub struct Sentencer {
    pub sentence_owner: Pubkey,
    pub bump: u8,
    pub name: String,
    pub body: String,
    pub price: u64,
    pub listed: bool,
}

#[derive(Accounts)]
#[instruction(name: String, body: String, sentence_bump: u8)]
pub struct NewSentence<'info> {
    #[account(init, payer = user,
    space = Sentencer::space(& name, & body),
    seeds = [
        b"sentencer",
        user.to_account_info().key.as_ref(),
        name_seed(& name)
    ],
    bump = sentence_bump)]
    pub sentence: Account<'info, Sentencer>,
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(sentence_name: String, price: u64)]
pub struct ListSentence<'info> {
    #[account(mut,
    has_one = sentence_owner @ SentError::WrongOwner,
    seeds = [
        b"sentencer",
        user.to_account_info().key.as_ref(),
        name_seed(& sentence_name)
    ],
    bump = sentence.bump)]
    pub sentence: Account<'info, Sentencer>,
    pub sentence_owner: AccountInfo<'info>,
    pub user: Signer<'info>,
}

#[error]
pub enum SentError {
    #[msg("This listing belongs to someone else")]
    WrongOwner,
    #[msg("Specified item creator does not match the pubkey in the item")]
    WrongItemCreator,
}

impl Sentencer {
    fn space(name: &str, body: &str) -> usize {
        // discriminator + owner pubkey + bump +
        8 + 32 + 1 + 2 +
            // name string
            4 + name.len() +
            // body string
            4 + body.len() +
            //listed bool
            2 +
            //u64
            8
    }
}


fn name_seed(name: &str) -> &[u8] {
    let b = name.as_bytes();
    if b.len() > 32 { &b[0..32] } else { b }
}