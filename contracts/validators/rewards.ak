use aiken/builtin
use aiken/collection/list
use cardano/address.{VerificationKey}
use cardano/address
use careloop/fixtures
use cardano/transaction.{Input, Output, NoDatum}
use cardano/transaction
use cardano/assets
use cardano/transaction.{InlineDatum, OutputReference, Transaction, find_input}
use careloop/proof.{Proof, VerificationKey as ZkKey}
use careloop/state.{State}
pub type Action { PublishRoot { root: Int } Claim { proof: Proof, nullifier: Int, recipient: ByteArray, binding: Int } }
// Unique one-shot state NFT is a deployment prerequisite. No caller-supplied VK.
validator rewards(clinic: ByteArray, state_policy: ByteArray, state_name: ByteArray, vk: ZkKey) {
 spend(datum: Option<State>, action: Action, own_ref: OutputReference, tx: Transaction) {
  expect Some(s)=datum
  expect state.valid_state(s)
  expect Some(own)=find_input(tx.inputs,own_ref)
  expect assets.quantity_of(own.output.value,state_policy,state_name)==1
  expect assets.quantity_of(tx.mint,state_policy,state_name)==0
  expect [next]=list.filter(tx.outputs,fn(o){assets.quantity_of(o.value,state_policy,state_name)==1})
  expect next.address==own.output.address
  expect next.reference_script==own.output.reference_script
  expect InlineDatum(raw)=next.datum
  expect new: State=raw
  when action is {
   PublishRoot {root} -> {
    expect proof.canonical(root)
    and {list.has(tx.extra_signatories,clinic),new==State {..s,root},next.value==own.output.value}
   }
   Claim {proof:p,nullifier,recipient,binding} -> {
    expect builtin.length_of_bytearray(recipient)==28
    expect new==state.after_claim(s,nullifier)
    expect next.value==assets.add(own.output.value,#"",#"",-s.amount)
    expect list.any(tx.outputs,fn(o){
     o.address.payment_credential==VerificationKey(recipient) &&
     assets.lovelace_of(o.value)==s.amount
    })
    proof.verify(vk,p,[s.root,nullifier,s.program,s.period,s.amount,builtin.bytearray_to_integer(True,recipient),s.domain,binding])
   }
  }
 }
 else(_) { fail }
}

// Exercise the full spending validator, including outputs and authorisation.
const clinic_key = #"11111111111111111111111111111111111111111111111111111111"
const nft_policy = #"22222222222222222222222222222222222222222222222222222222"
const nft_name = #"436172656c6f6f70"
fn test_state() -> State {
 expect [root,_,program,period,amount,_,domain,_]=fixtures.inputs()
 State {root,program,period,amount,domain,used:[]}
}
fn test_ref() -> OutputReference {
 OutputReference {transaction_id:#"0000000000000000000000000000000000000000000000000000000000000000",output_index:0}
}
fn test_action() -> Action {
 expect [_,nullifier,_,_,_,recipient,_,binding]=fixtures.inputs()
 Claim {proof:fixtures.valid_proof(),nullifier,recipient:builtin.integer_to_bytearray(True,28,recipient),binding}
}
fn test_tx() -> Transaction {
 let s=test_state()
 expect [_,nullifier,_,_,_,recipient,_,_]=fixtures.inputs()
 let pool=Output {address:address.from_script(#"33333333333333333333333333333333333333333333333333333333"),value:assets.add(assets.from_lovelace(20000000),nft_policy,nft_name,1),datum:InlineDatum(s),reference_script:None}
 let next=Output {..pool,value:assets.add(pool.value,#"",#"",-s.amount),datum:InlineDatum(state.after_claim(s,nullifier))}
 let payout=Output {address:address.from_verification_key(builtin.integer_to_bytearray(True,28,recipient)),value:assets.from_lovelace(s.amount),datum:NoDatum,reference_script:None}
 Transaction {..transaction.placeholder,inputs:[Input {output_reference:test_ref(),output:pool}],outputs:[next,payout]}
}
test valid_claim_transaction() {
 rewards.spend(clinic_key,nft_policy,nft_name,fixtures.vk(),Some(test_state()),test_action(),test_ref(),test_tx())
}
test rejects_missing_payment() fail {
 let tx=test_tx()
 expect [next,_]=tx.outputs
 rewards.spend(clinic_key,nft_policy,nft_name,fixtures.vk(),Some(test_state()),test_action(),test_ref(),Transaction {..tx,outputs:[next]})
}
test rejects_diverted_payment() fail {
 let tx=test_tx()
 expect [next,payout]=tx.outputs
 let wrong=Output {..payout,address:address.from_verification_key(clinic_key)}
 rewards.spend(clinic_key,nft_policy,nft_name,fixtures.vk(),Some(test_state()),test_action(),test_ref(),Transaction {..tx,outputs:[next,wrong]})
}
test rejects_reset_nullifiers() fail {
 let tx=test_tx()
 expect [next,payout]=tx.outputs
 let reset=Output {..next,datum:InlineDatum(test_state())}
 rewards.spend(clinic_key,nft_policy,nft_name,fixtures.vk(),Some(test_state()),test_action(),test_ref(),Transaction {..tx,outputs:[reset,payout]})
}
test rejects_extra_pool_withdrawal() fail {
 let tx=test_tx()
 expect [next,payout]=tx.outputs
 let wrong=Output {..next,value:assets.add(next.value,#"",#"",-1)}
 rewards.spend(clinic_key,nft_policy,nft_name,fixtures.vk(),Some(test_state()),test_action(),test_ref(),Transaction {..tx,outputs:[wrong,payout]})
}
fn root_tx() -> Transaction {
 let tx=test_tx()
 expect [input]=tx.inputs
 Transaction {..tx,outputs:[Output {..input.output,datum:InlineDatum(State {..test_state(),root:123})}],extra_signatories:[clinic_key]}
}
test clinic_can_publish_root() {
 rewards.spend(clinic_key,nft_policy,nft_name,fixtures.vk(),Some(test_state()),PublishRoot {root:123},test_ref(),root_tx())
}
test stranger_cannot_publish_root() {
 let tx=root_tx()
 !rewards.spend(clinic_key,nft_policy,nft_name,fixtures.vk(),Some(test_state()),PublishRoot {root:123},test_ref(),Transaction {..tx,extra_signatories:[]})
}
