use aiken/collection/list
use cardano/assets
use cardano/transaction.{OutputReference, Transaction}
// One-shot state NFT. Deployment must lock it at the parameterised reward script.
validator identity(seed: OutputReference, clinic: ByteArray) {
 mint(_redeemer: Data, policy: ByteArray, tx: Transaction) {
  expect [(_, name, quantity)]=assets.flatten(tx.mint)
  and {
   list.any(tx.inputs,fn(i){i.output_reference==seed}),
   list.has(tx.extra_signatories,clinic),
   name==#"436172656c6f6f70",quantity==1,
   assets.quantity_of(tx.mint,policy,name)==1,
  }
 }
 else(_) { fail }
}
