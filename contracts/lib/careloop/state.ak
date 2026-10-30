use aiken/collection/list
use careloop/proof
pub type State { root: Int, program: Int, period: Int, amount: Int, domain: Int, used: List<Int> }
pub fn after_claim(s: State, nullifier: Int) -> State {
 expect proof.canonical(nullifier)
 expect !list.has(s.used, nullifier)
 expect list.length(s.used) < 8
 State { ..s, used: [nullifier, ..s.used] }
}
pub fn valid_state(s: State) -> Bool {
 list.all([s.root,s.program,s.period,s.amount,s.domain, ..s.used], proof.canonical) && s.amount > 0 && list.length(s.used) <= 8
}
test duplicate_rejected() fail {
 let s=State {root:1,program:1,period:5,amount:2000000,domain:42,used:[123]}
 after_claim(s,123)==s
}
test field_alias_rejected() fail {
 let s=State {root:1,program:1,period:5,amount:2000000,domain:42,used:[]}
 after_claim(s,proof.modulus + 123)==s
}
test claim_preserves_scope() {
 let s=State {root:1,program:1,period:5,amount:2000000,domain:42,used:[]}
 after_claim(s,123)==State {..s,used:[123]}
}
