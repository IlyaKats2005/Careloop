pragma circom 2.2.3;
include "vendor/poseidon_bls12_381.circom";

// Demo: depth 3 (8 approval leaves). BLS12-381 scalar field only.
// Public order MUST match the Aiken validator and transaction builder.
template Reward() {
    signal input root;
    signal input nullifier;
    signal input program;
    signal input period;
    signal input amount;
    signal input recipient;
    signal input domain;
    signal input binding;
    signal input secret;
    signal input siblings[3];
    signal input directions[3];
    component commitment = PoseidonBLS12_381();
    commitment.in0 <== 1; commitment.in1 <== secret;
    component scope = PoseidonBLS12_381();
    scope.in0 <== program; scope.in1 <== period;
    component scoped = PoseidonBLS12_381();
    scoped.in0 <== domain; scoped.in1 <== scope.out;
    component identity = PoseidonBLS12_381();
    identity.in0 <== commitment.out; identity.in1 <== scoped.out;
    component leaf = PoseidonBLS12_381();
    leaf.in0 <== identity.out; leaf.in1 <== amount;
    component nf = PoseidonBLS12_381();
    nf.in0 <== secret; nf.in1 <== scoped.out;
    nullifier === nf.out;
    component bind = PoseidonBLS12_381();
    bind.in0 <== nf.out; bind.in1 <== recipient;
    binding === bind.out;
    signal nodes[4];
    nodes[0] <== leaf.out;
    component hashes[3];
    for (var i=0; i<3; i++) {
        directions[i]*(directions[i]-1) === 0;
        hashes[i] = PoseidonBLS12_381();
        hashes[i].in0 <== nodes[i] + directions[i]*(siblings[i]-nodes[i]);
        hashes[i].in1 <== siblings[i] + directions[i]*(nodes[i]-siblings[i]);
        nodes[i+1] <== hashes[i].out;
    }
    nodes[3] === root;
}
component main {public [root,nullifier,program,period,amount,recipient,domain,binding]} = Reward();
