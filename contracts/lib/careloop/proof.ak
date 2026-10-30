use aiken/builtin
use aiken/collection/list
use aiken/crypto/bls12_381/g1
pub const modulus = 52435875175126190479447740508185965837690552500527637822603658699938581184513
pub type Proof { a: ByteArray, b: ByteArray, c: ByteArray }
pub type VerificationKey { alpha: ByteArray, beta: ByteArray, gamma: ByteArray, delta: ByteArray, ic: List<ByteArray> }
pub fn canonical(n: Int) -> Bool { n >= 0 && n < modulus }
fn accumulate(inputs: List<Int>, points: List<ByteArray>, acc: G1Element) -> G1Element {
 when inputs is {
  [] -> acc
  [x, ..xs] -> {
   expect [p, ..ps] = points
   accumulate(xs, ps, builtin.bls12_381_g1_add(acc, builtin.bls12_381_g1_scalar_mul(x, builtin.bls12_381_g1_uncompress(p))))
  }
 }
}
// Fixed circuit arity and canonical field inputs. VK is a script parameter.
pub fn verify(vk: VerificationKey, p: Proof, inputs: List<Int>) -> Bool {
 expect list.length(inputs) == 8
 expect list.length(vk.ic) == 9
 expect list.all(inputs, canonical)
 let v = accumulate([1, ..inputs], vk.ic, g1.zero)
 let lhs = builtin.bls12_381_miller_loop(builtin.bls12_381_g1_uncompress(p.a), builtin.bls12_381_g2_uncompress(p.b))
 let rhs1 = builtin.bls12_381_miller_loop(builtin.bls12_381_g1_uncompress(vk.alpha), builtin.bls12_381_g2_uncompress(vk.beta))
 let rhs2 = builtin.bls12_381_miller_loop(v, builtin.bls12_381_g2_uncompress(vk.gamma))
 let rhs3 = builtin.bls12_381_miller_loop(builtin.bls12_381_g1_uncompress(p.c), builtin.bls12_381_g2_uncompress(vk.delta))
 builtin.bls12_381_final_verify(lhs, builtin.bls12_381_mul_miller_loop_result(rhs1, builtin.bls12_381_mul_miller_loop_result(rhs2, rhs3)))
}
