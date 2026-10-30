(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // src/network.js
  var NETWORK = "Preprod";
  var NETWORK_ID = 0;
  var NETWORK_MAGIC = 1;
  var EXPLORER = "https://preprod.cardanoscan.io";
  var STORAGE_KEY = "careloop-preprod-v1";
  function assertRecoveryNetwork(saved) {
    if (saved?.network !== NETWORK || saved?.networkMagic !== NETWORK_MAGIC) {
      throw Error("This recovery file is not a Cardano Preprod enrollment. Preview and unlabelled legacy files cannot be restored here. Keep the original file and create a new Preprod enrollment.");
    }
    return saved;
  }

  // src/poseidon-constants.js
  var poseidon_constants_default = { "POSEIDON_C": ["0x6c4ffa723eaf1a7bf74905cc7dae4ca9ff4a2c3bc81d42e09540d1f250910880", "0x54dd837eccf180c92c2f53a3476e45a156ab69a403b6b9fdfd8dd970fddcdd9a", "0x64f56d735286c35f0e7d0a29680d49d54fb924adccf8962eeee225bf9423a85e", "0x670d5b6efe620f987d967fb13d2045ee3ac8e9cbf7d30e8594e733c7497910dc", "0x2ef5299e2077b2392ca874b015120d7e7530f277e06f78ee0b28f33550c68937", "0x0c0981889405b59c384e7dfa49cd4236e2f45ed024488f67c73f51c7c22d8095", "0x0d88548e6296171b26c61ea458288e5a0d048e2fdf5659de62cfca43f1649c82", "0x3371c00f3715d44abce4140202abaaa44995f6f1df12384222f61123faa6b638", "0x4ce428fec6d178d10348f4857f0006a652911085c8d86baa706f6d7975b0fe1b", "0x1a3c26d755bf65326b03521c94582d91a3ae2c0d8dfb2a345847aece52070ab0", "0x02dbb4709583838c35a118742bf482d257ed4dfb212014c083a6b059adda82b5", "0x41f2dd64b9a0dcea721b0035259f45f2a9066690de8f13b9a48ead411d8ff5a7", "0x5f154892782617b26993eea6431580c0a82c0a4dd0efdb24688726b4108c46a8", "0x0db98520f9b97cbcdb557872f4b7f81567a1be374f60fc4281a6e04079e00c0c", "0x71564ed66b41e872ca76aaf9b2fa0ca0695f2162705ca6a1f7ef043fd957f12d", "0x69191b1fe6acbf888d0c723f754c89e8bd29cb34b1e43ab27be105ea6b38d8b8", "0x04e9919eb06ff327152cfed30028c5edc667809ce1512e5963329c7040d29350", "0x573bc78e3ed162e5edd38595feead65481c991b856178f6182a0c7090ff71288", "0x102800af87fd92eb1dec942469e076602695a1996a4db968bb7f38ddd455db0b", "0x593d1894c17e5b626f8779acc32d8f188d619c02902ef775ebe81ef1c0fb7a8f", "0x66850b1b1d5d4e07b03bac49c9feadd051e374908196a806bd296957fa2fe2b7", "0x46aaa1206232ceb480d6aa16cc03465d8e96a807b28c1e494a81c43e0faffc57", "0x2102aab97ce5bd94ffd5db908bf28b7f8c36671191d4ee9ac1c5f2fae4780579", "0x14387b24d1c0c712bbe720164c4093185fcb546a2a7d481abc94e5b8fb5178b7", "0x5f2179b3a7845836cfced83e64e206f6a6cef2cf737f020b5cfd713c9550fe9f", "0x1787986ab56e1b56b5443334562b0bc3657d27323b87e3a8485e68ab96d57188", "0x39ef4b00deefe7e7451adda44428aa22074c496de2c9ed67dcf4861da65f543a", "0x7271d384cf5c90fd0c48af190c5c765937c7468088b081a99337e6eae53bb20c", "0x6669e58d04248ca86024fbc196e5f306e522423aa71f84225435328b37a1dd3d", "0x0c1f1b492b27539d754cba5e46edc1f1ac1c5696da8eb19416b07420bb321c65", "0x1c4d41a133b97dc467f1f184cf191f331dfc38e79e7e53516c39848c9bd44692", "0x369ea8e699181b1cf88be9205ab840180c9288e67a359dc0dda4ac74cf9768e2", "0x4cfa7d72afed332bf0b8a2a719123f7ebfa714b9e3100eaa533dbde6fb985043", "0x4e592fcde9f3c360e54c6f34d7a8bd41889942e9fe23d9fd4a9e5b3bfbbb3e45", "0x032b5885586212fb235570996d3a4c40f54ff91598a948ec2722ed865b8438a5", "0x03f3178956cfd3e2e6614fb134597d3b3cff0d8a33f3523d825982990c068940", "0x3126e84dfd67a22bf0ce0d9273d8ad40e6109af5bb2bd78d0ac08a16c6248f74", "0x3527888062f1e2738d7b928e9af244f0a39011390c2dbbcf56d8e087f4087b6f", "0x64635758efc701dbbe2eb423bf7b5bf6c3d34c6ff92494f3421182a8b187ecf7", "0x4d7f71960f03db8a2a428cbf77ddc1916a5f4243dbeb2ddaef7b5b5f9d74546e", "0x37832ba2da93de3643243eba3b9765d75359310617f3fc06d74ac12db57b29c5", "0x4dce55879ffd9398f96c9e6556a3bb4fc93147965252cb1d6c94b3282ba3fae6", "0x4ba85e4d2537972c0fd5a4727a58c3d85d98563697a34c0af845bfecd6dc4b40", "0x582dc453b4cbf6b1d19734b0f337d3423b503703979689f384d0eb96ff5b02ce", "0x0e6f127f479ee6113540d69b25420a2682f07b23e799566b091a1c891fa224ba", "0x39c815508d2995bb8ae5035472944706e900b2fb16d5a779fdfff82306f37dbb", "0x6591aba215bcf96d8aa03220372179a4c5060cfd7f95724ab300d9459f709051", "0x221807cb4909d549c546a734ad2cd7f60a69e816ace98fad830452a44a343188", "0x2766a1e33038004da58bce78722380b22b13b0aecb87f38659f3035e1336b53f", "0x11b5e993e6a9cdc3b5d2f5336dc9bad5074b661537ff890b1babd7f53cada9e3", "0x29576176f9a5a10e3d0a2c59af26b51f4c5fc86ec59c0f2492deb60ad49eddcd", "0x51e72c44f9de491c747d8a6d333fb2b3e16ee7571f1340a9a5f6f72363991e98", "0x2fb360d959be4aa871e071764a5e41eb264d04f0289f098723b69bab09f4d1a6", "0x03f46b4c3c77957cb595ed61fe13f9e8739a5009311142b69c1e8c07ae250f47", "0x4683311e382a99927e0ff672cd0543aaebfc0c33ba96ad937818cec979b57b5e", "0x7117cc69bf566b1b0ba5486b0f1f9bd60f2f945e3cbf33a2ed17076f4caa0dd6", "0x3bd670c3ce88ea43f254d61c2a9b56d6a4dff19ab5c4d28989d271f3dd6bee25", "0x2fd2ed0ba1135575995d15061ddb487f2c5c6005feed28d8a01b9d7bee361a1b", "0x6a66704e22a81e6b7ad8e2f28edd8c9c9a10abf17e053f4d89665810332600ec", "0x5cbc378be1db3840b32d8d2ebfe2695f810f932a206aacece707ca693f4f933e", "0x35b716410b3c9374d42e7d39eaca316b6568f0a14cb14d519967aa3ff9970aac", "0x231c6db056e47a01c192db40e586ededc929b564667377a10bd1465f3852811f", "0x4904d5de1f512eb14b0f856acb016c7a43079b2f702303752962f336558b0f32", "0x56d6bc63f429bb7fec7bdd133581f2abc74406a57607c2ba3302481eddba4074", "0x519d0daccadfbb0167fa79d1afdf36b25f28b9f74f1e65d21d28ce1022579735", "0x0576cf2418d6bd88f352bb26da1066637575f85688cdb981c7787f8094e5a71a", "0x16672be70221dfa20aa110bdce12e1e66ab171db4eadd9935baa0e3aa49e437a", "0x1e51c73bc2aeb9e877d9c2c18f17b03ea3dfcc04adfc649780ce4bcbc43b0b69", "0x1271c830507a211c8e2ebdfb372f79c8a42a9e84e4fdb0dcb35d55e4d155e169", "0x67077397c2b01db4de4b78adf97e0ebceb20cb91647db49a7bc06a5ce1b25544", "0x2e5454b258106b63f0ab01924767b4aecce371202abc28a260adc45f35570b9d", "0x440f72769f137a8078f05063cfa4e2b73b2381b72b68e97b1c1e9cd18df36f82", "0x6ae1478fc162c50032fef2ef79c93ca7ee25b16358704f434f6cddcce2fc9c40", "0x0c0f3630409a2242a39ebb33c5c7cf18965b8932621aab4ca2c315d4441b6987", "0x0d1bd84a786a990adf88b51f253bd9032cb50ce4682bafe103893af36d5e75dc", "0x30ce425059810dd94aae2f255666b0fe8bc52ff701c385c43a998926539dd401", "0x395a1e753153b56d1a9ec2ca73099425e446dfa668dc73da2ea311abe5e3d96d", "0x57f09d89e827d00392fdc0c3d21b1a5bae2d689894ced82f58e256a03d20ef91", "0x1065b71b135e4feb8b3cba3c252daa084cb5624b0ba76f48f6a03854bfdbcacc", "0x3d5f53bd162f053f045547952a06bc83bc413e17957977e359d9bd4c8883203d", "0x05f467a5081bd3479d6b49f697b0a75d264b42b95b2bed475cd58ffd05322d85", "0x6f5ad8e3ed272494c36a5a52a7d034e04b633460c16a512d0d8002f8fa0e3484", "0x23c293275e282bf15cdbffae1f00a2712e76aa6d62820542159e9d6f115df3b8", "0x3757e7009ca9bec8bba29308b9922354eeeff3beb4113174bf8cde584722d31b", "0x406f25e72d0264ed50473ec95a7ec53ebe114898f84deb06e53715ae24725342", "0x046dcfa2d6d655c7c551f7440772b056e7d3f2c65ac52e4496c4fc753130ad45", "0x49c2e954d649ee1c4e72ce8c1833c33796ab29dbb0486fe53b04687b2063259f", "0x2caa8aae247ef83e63dbe8e5efc89d7d28ffd8bf7a5331e245af8aebc872a759", "0x5efa9f8f32d9ec1d3a3d8cea806e068909b3d3562fdc3f91f2d899f8109bc717", "0x0df424bdf3b0c60395cd7380029a633692b933250b79371e09122c8c39aa1301", "0x2d012e3e811cf4b88aed6f38d5cc8c3456dbae1741f501574321906efb474930", "0x709c043fc648c48a5bfb5ea25d5f0557d03aadff9d6ec1afaf2032f3aadb9dba", "0x1bb9b23d6805ed1179a1dad95740513dcea114185a8ed34e17dc8077dc830916", "0x0fab922a838c55af1e2349b1e50b56d0690c200d0f2318aad4b7bd8a38a47f61", "0x4d58799d4501ee8e89c73db7a4ff48d9f5e80fd5984afc67f3054f59d3dc74d1", "0x4f130b733cb78f3940da337d187934e48765956ad2ca7b75b7bf8e293b46a758", "0x03e7812afd6c480faef03c3beadfb882923a743a4e60e58a259e7ed4598cca97", "0x739ea276a5ef7008fffc02a3c853f4d56eaeee7df395cbee8bbe6b502b81ca1a", "0x0ae97e00a91a4e761815fde0e9506629373ef7ce765ecb1bc7ba0ca2decd7d01", "0x6d6c41e1315436781a774555668cc3d41c99c78dc107f443ba0ae60cdb287c16", "0x18d683776871c1918c2b5c632cb1854dff865c4b1b8bd66e46d2fa2a8d515c34", "0x3597acab641c21dc5475eb8b04b0e2ae91700acad1b543e8c7e69d574eb5a15a", "0x63df64938297594b4e8bf2ddd6bcaee6f2b9703e5814ddeca44d341b9e7d24a2", "0x009ab455f6b4c7755da22615073e9839cd12a88d1f9b583d7ad61bde4009b873", "0x09e21d43c56b0abfc26d0fb7a3ebfd3a7743bbeea99ac2b8f61cc23d1c673a12", "0x4db404b9eae6a9f39417be43c93a9f6d136a0784b73789d590ada0a60df0d16c", "0x0c6f0ecaf32a3d60aaebeaf3f8ccb00a10ee19def3836b78fc905bfeaf2b80a9", "0x3518d688407ca0e548165b9796a4279d038720408a3c822dc44ce8974ea8ad8d", "0x27ba9d4584a23881e23aa0340dc266b32b56455c30e6da78b37741de7ac5b185", "0x63d33e44fda7868d50858e482fbff7c29143d60fe00817cf32e0efab4c3ad6eb", "0x561a72b93fecdbd83d67a5022d9a221cf21b22cff2d79c114bf01c71f2641ae9", "0x48a1625a9ee1102971aa28bc07a5ba88ac6424801502ff4fcb6994824c2e5e36", "0x46a003c184ecf0e00fa8ef7dbb356366be4d63a3847634b46a18ecd47667d1bc", "0x37d6efb2876f3cba63a60821e50853d0997947b96f633607bb36ded243ded838", "0x14f96acdb291ed2bf98a5bed063f6911598bdff1f6c0219bbefa447ab1918163", "0x573d156263dc8edf24efced0c465587cbdd1a2c792cbadd58abf95e037d3c668", "0x46839e7d70370149b35b3a07d8406acbaff07615747d2101bbad18abb9891f95", "0x3b74a3420d1b988408fe8d8fcb51a81f16f8d17d082da9ba61fbc8031d8ff59b", "0x059f3301178a22026798b07a8578611d7c56c16bfbbe6a058f4e44016aaa172d", "0x467d9ff3508feb318b07acf9184537462e987c58b7ef486873e1de428eaa3f32", "0x716cac6b0fc8f63d406d38d6b82c8ed4e5665e449f07b572b83f43c9f9ba2004", "0x7121fa9ca506687b3c49dc2060731c85ae48596be138148d8ea365333b8f03a6", "0x10000c75e6e03366bba4f59c68f312becb7ae0c30d4aa141940a7531105ef7e0", "0x375487214c07542fa5b6a5736344466a06c2cb4c1838c9966925cd8c5888c3ca", "0x2361aaf969f732be06b159772a097f3518ed9485449edcfd367e289f0964c486", "0x2ddba8679308f327c27023a893c0458d1e73dcd64a39b22b130fd9e4f283f906", "0x6303e21755b1de4d65495bae9685e05162245106f53d7407ec0883e39695b15c", "0x5aa3dddf8da369722b2e1c8f2aacf0625d08264f8a0ed320df110ab42f5b0c1f", "0x3525eb41c2db9cf9cd08652d815d7c91f3294defeee702efedb5f777284cd1fd", "0x0079ae4df49f78b97cb0e3c3f4b225538d4a0c4827e333d27a29398c17c26c9e", "0x533c8c1b05e2dd7e7e19ea4b027cc8bd559c2e2a622207b0c13bc7afdd7bc3b7", "0x4989a01e4fe4b1bd544e5cd4288895068897cba899ddb01779f6e2b08024d3ab", "0x1c7f5858eabb1e2b8c3104808dc68ae3de05381fc74704a2afbd2fcc42cdd3c8", "0x55faf16bbea2ee0f35413b9808c135fb1e4729c90b4cce4c345238c6dc557639", "0x156a82f8e5aea455d9c8c436f89c6f9ecbce0ecaafdd13b93f255e075c72ebd0", "0x37c7047032df0027d7bc128e9a107582f25ba0b7387230a05864aee420724703", "0x40ab847795176c24af06d5000ceedb82d87492cbde5c1c262a83a9b6b6f4b264", "0x5a73bece689545bd2de9ef263d5036152f36e2250c76711e8bc9ed9bda7af685", "0x1c4a903be5dff4440b4f38e56f988cddacc57371aeebb06cb64ab5d21d9562f5", "0x5bba81a692e87b51c7c176730fd05cfd100b0bd86d69b4b4f367277a2302b2f8", "0x2f875bdd6669a8ff920c3d7bedd74c101541d4b184b7e1bc0b90ddb26902319d", "0x5e89035bbe943f9e6024db13c58bbc748d3f1654050c7ffe084b763efceff3bd", "0x728cff754d7a76a7f8b00656412ad8874e7bab9827706ca6d6d13c72a0c6812e", "0x6dcfa6338bfe3569524a968abc95c706801fcc695ee3f5854a79e4689625481c", "0x24ce56469aeaa4243053bb62c07100002b8f74c4ac74c350beff0c0be47e5a51", "0x6a72f954f591825caa43c3ba7ccfea7aa1a00de5a681e52de6148252062f8363", "0x59922ae3f06524d2028e9aa00a136613d4306fd5f4247ad0a6a587be0fb0081c", "0x50d8b98688f4980b1a0c2b5313f8ac9660b1e9199b5f59ed3709e0f1d9185552", "0x3184262ef10e9b0ab57cfc898fb68342cb86ed6e25e536fa94caa605b4a3caf1", "0x69980a1f4b883cac1039fc47dba993503d4ae5ad40ed112a5a5070090006f73e", "0x1d5a91b930b89934745ba00bd9094b67f95e41e3778fe0420880e80bbf8078e1", "0x0ddebce4b6ca45d69b2f70c8b54e425615c1aadadccda74e0882eb79c445778f", "0x68c8362e93a371d7c9551edf3e3f3b14c54c729c1fab0fa6eebae7da09855826", "0x3dcc6a17e074d0350ffc0e5426e1bb6894e6c958f96f3d7d9c4240b948cde438", "0x03b8aba0ee959a4e51cb5cfc458b0f4ad3a9b59797394c3d3c9eb57adeca2308", "0x0f24cc57f3b2fbf25375c71d71bbb97b2d193fc1a203ccc514c074d461001ec4", "0x71e9bfa7f66afbafbf139a70baedfb1b202a2e51e6b6c420e28dd342a5eb0cd6", "0x3ac9c11890e96a2dcda6405a6c52a47e803d6674e65117f1a8adf701d68cd02a", "0x45c00146e1b89ad5ccb8a02202482023751b88997d8fba1af5c0e7a68dadb63c", "0x1f98bdb8dc318e3e2e28cc3d8b85e334f74b57e15b02e1637ae035b04bda3b5c", "0x2ec077dbbc7bf2affe7ddd8b8a7f900f3019cddc8ce55cf9782004f65f51257b", "0x32c377fc988f600a2c2ef5d5376e2e31faf1c2d1a618db011fbfec1ff337568d", "0x0a820d131da844383bdfc1a053d8aceec7f2eb345ab6c21d38e829db8d05861e", "0x5bd95df8a933f7b7e263e013f45a92c0e786dba563e210b77d5a40f961092e60", "0x264cf7b75095fb96b420fb3f31c064299e78e796e8b3735bd0a186cd3817708d", "0x27d3e47b2f11ada6a9a5d329e00a128c9836be92ee92429ab891e71d11dc29f2", "0x64354b412c8cfa1319e4afd891e619a8fbbde04d85bef4ad0548689295d2bce2", "0x0db0f967487ee52e0836fb7135bce37fbd32887e911de52d0b855a5afac1f770", "0x1c9a155911b36c896475995417197faad870737a9ce5d9d3a5000f5396978e9d", "0x65ae557151ae9ec7f870fa2804bfb88e669dc0f8865b140f964f1f93180ac531", "0x52c6f6242517362c066020764fef4a5574749106a6dad534d136e7fe885fcb40", "0x6e44c5bcd5dc6591e2f84290a313b71a04da8da398dd10135d22bb23df41e883", "0x2146d3e371040feba8595049a285944bd45a458dccb059c785c2adf032c8b710", "0x16db9ceb3074a795499a37c20ffc9eaca9b07a5a25824aa6adcdb19fabdff0b9", "0x5903725fd86fec14c9cf2a273017eb01d3a1785039397060650c4e228a6e6571", "0x54c75952f908e3f99e05718bd1f59bb6c414bc2aebacd81c47189885cbbc566a", "0x0dba4abc7f188e33e7f309317b7b9f5c22870ca90bcee7b576dd0b52619a39f6", "0x3950231611808399ad3ba5b78cad4c6bed6f364b9346541dfffa4d16366d257e", "0x1a6d8230bb9e8d1af552b9bab8babfe505931dd87e200fc7b3c57160a5bc4ae2", "0x6b3dd35220ecd616eea4309ac9a8118e9dc65a3f7c1ef52dde7a3d33578c43a0", "0x6da00240c3505b214c8d8ce3f48914247adb9f0ecf239d7baeada5183d31ba54", "0x37c3720b132d3a719424e29c37acb7dfbd709ec9497a3162175424bf063c6e18", "0x500f85a3d06a0b5a05c5e93ae70084802fd499c7e6ed1ee6e26b4bf8fd6838fb", "0x2b37f70d73366d32d575186d0787fc8ce539b73f83c6e7eaab27be85f4faaaf4", "0x1d8efd6e52d4f936415e5c4814f3366804e2386857a4befa2a53aab21ddb68de", "0x33303b8a8f2d811be65a977907d17d133f3a64c59fe2a9c5c2d4517e3eb390e3", "0x2c1ba860f51e0c2eaf4a9a6bf095c65fab3ee15c145f404fbb0272b5ca14a449", "0x0b0849c7a3adea03a89d101081c9c9f4f66ef917d09c7957584db9a75aec2378", "0x41e7e30c77579da7809c3e757821c869b53f103fcb752ac82f8a734d4abdc792", "0x182e66be60686c8c5e6518430845f98924fe8d7d43e628bf75ff52a716371b9c", "0x373b2508c2fca1a288fa4f54a6edf02f2661e664dcf4ff2a74f3d06b1a00ddc4", "0x1735b442b3acaad0bbe630f308e03f1aa6f56bdb029e50c1393533cee1a45c30", "0x22abe8ea470a0372911bcef1367e10aa220491d76caeaa5959feb5d75f4a1f9f", "0x5caab387eb997f774f64151ed21abfa5364a83c6f065d92bd9c92f2719b8e80b", "0x57b33094aeff828377897b56e1c432978d07c668ef25a36bc5e2e835aaeff725"], "POSEIDON_M0": ["0x3d955d6c02fe4d7cb500e12f2b55eff668a7b4386bd27413766713c93f2acfcd", "0x3798866f4e6058035dcf8addb2cf1771fac234bcc8fc05d6676e77e797f224bf", "0x2c51456a7bf2467eac813649f3f25ea896eac27c5da020dae54a6e640278fda2"], "POSEIDON_M1": ["0x20088ca07bbcd7490a0218ebc0ecb31d0ea34840e2dc2d33a1a5adfecff83b43", "0x1d04ba0915e7807c968ea4b1cb2d610c7f9a16b4033f02ebacbb948c86a988c3", "0x5387ccd5729d7acbd09d96714d1d18bbd0eeaefb2ddee3d2ef573c9c7f953307"], "POSEIDON_M2": ["0x1e208f585a72558534281562cad89659b428ec61433293a8d7f0f0e38a6726ac", "0x0455ebf862f0b60f69698e97d36e8aafd4d107cae2b61be1858b23a3363642e0", "0x569e2c206119e89455852059f707370e2c1fc9721f6c50991cedbbf782daef54"] };

  // src/zk-core.js
  var FIELD = BigInt("0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001");
  var C = poseidon_constants_default.POSEIDON_C.map(BigInt);
  var M = [poseidon_constants_default.POSEIDON_M0, poseidon_constants_default.POSEIDON_M1, poseidon_constants_default.POSEIDON_M2].map((r) => r.map(BigInt));
  function field(x) {
    const v = BigInt(x);
    if (v < 0n || v >= FIELD) throw Error("Non-canonical field element");
    return v;
  }
  function hash(a, b) {
    let s = [0n, field(a), field(b)];
    for (let r = 0; r < 65; r++) {
      s = s.map((v, i) => (v + C[r * 3 + i]) % FIELD);
      s = s.map((v, i) => r < 4 || r >= 61 || i === 0 ? v ** 5n % FIELD : v);
      s = M.map((row) => row.reduce((v, c, i) => (v + c * s[i]) % FIELD, 0n));
    }
    return s[0];
  }
  var config = { program: "1", period: "5", amount: "2000000", domain: "20261030" };
  function commitment(secret2) {
    return hash(1n, secret2).toString();
  }
  function scope(c = config) {
    return hash(c.domain, hash(c.program, c.period));
  }
  function leaf(commit, c = config) {
    return hash(hash(commit, scope(c)), c.amount).toString();
  }
  function randomSecret() {
    let x;
    do {
      x = BigInt("0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) => v.toString(16).padStart(2, "0")).join(""));
    } while (x === 0n || x >= FIELD);
    return x.toString();
  }
  function tree(leaves, index) {
    if (leaves.length !== 8 || !Number.isInteger(index) || index < 0 || index >= 8) throw Error("Eight leaves required");
    let row = leaves.map(field), siblings = [], directions = [], i = index;
    while (row.length > 1) {
      siblings.push(row[i ^ 1].toString());
      directions.push(String(i % 2));
      row = Array.from({ length: row.length / 2 }, (_, j) => hash(row[j * 2], row[j * 2 + 1]));
      i = Math.floor(i / 2);
    }
    return { root: row[0].toString(), siblings, directions };
  }
  function witness(secret2, path, recipient, c = config) {
    const nullifier = hash(secret2, scope(c)).toString();
    return { ...c, ...path, secret: secret2, recipient: field(recipient).toString(), nullifier, binding: hash(nullifier, recipient).toString() };
  }

  // src/reward-status.js
  var identifier = (value) => typeof value === "string" && value.length > 0 && value.length <= 200 && value.trim() === value;
  var programIdentifier = (value) => typeof value === "string" && /^[A-Z][A-Z0-9_-]{1,31}$/.test(value);
  var canonical = (value) => {
    if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) return false;
    try {
      return field(value).toString() === value;
    } catch {
      return false;
    }
  };
  function asciiFieldId(value) {
    let encoded = 0n;
    for (const byte of new TextEncoder().encode(value)) encoded = encoded << 8n | BigInt(byte);
    return field(encoded).toString();
  }
  function programFieldId(programId) {
    if (!programIdentifier(programId)) throw Error("A valid program ID is required for reward approval.");
    return asciiFieldId(programId);
  }
  function periodFieldId(periodId) {
    if (typeof periodId !== "string" || !/^\d{4}-(?:W\d{2}|F\d{2}|\d{2}(?:-\d{2})?)$/.test(periodId)) throw Error("A valid reporting period ID is required for reward approval.");
    return asciiFieldId(periodId);
  }
  function cloudRewardApproval(report) {
    const source = report?.rewardApproval;
    if (!source) return null;
    if (!identifier(report.id) || source.reportId !== report.id || source.programId !== report.programId || source.periodId !== report.periodId) throw Error("Cloud approval does not match this report.");
    const c = Object.fromEntries(["program", "period", "amount", "domain"].map((key) => [key, source.c?.[key]]));
    if (Object.values(c).some((value) => !canonical(value)) || c.program !== programFieldId(report.programId) || c.period !== periodFieldId(report.periodId) || c.amount !== "2000000" || !canonical(source.root) || !canonical(source.commitment)) throw Error("Cloud approval has invalid program or reward terms.");
    if (!Array.isArray(source.siblings) || source.siblings.length !== 3 || source.siblings.some((value) => !canonical(value)) || !Array.isArray(source.directions) || source.directions.length !== 3 || source.directions.some((value) => value !== "0" && value !== "1")) throw Error("Invalid cloud approval path.");
    let node = BigInt(leaf(source.commitment, c));
    for (let i = 0; i < 3; i++) node = source.directions[i] === "0" ? hash(node, source.siblings[i]) : hash(source.siblings[i], node);
    if (node.toString() !== source.root) throw Error("Cloud approval path does not match its commitment and root.");
    return { reportId: report.id, programId: report.programId, periodId: report.periodId, periodLabel: String(source.periodLabel || report.period || report.periodId).slice(0, 160), root: source.root, siblings: [...source.siblings], directions: [...source.directions], commitment: source.commitment, c };
  }
  function publicRewardDeployment(dep2) {
    if (!dep2 || dep2.network !== "Preprod" || !/^addr_test1[0-9a-z]{40,180}$/.test(dep2.address || "") || !/^[0-9a-f]{56,120}$/i.test(dep2.unit || "") || !/^[0-9a-f]{56}$/i.test(dep2.clinic || "") || !/^[0-9a-f]{64}$/i.test(dep2.seed?.txHash || "") || !Number.isSafeInteger(dep2.seed?.outputIndex) || dep2.seed.outputIndex < 0) throw Error("Invalid public Preprod pool configuration.");
    return { network: "Preprod", seed: { txHash: dep2.seed.txHash, outputIndex: dep2.seed.outputIndex }, clinic: dep2.clinic, address: dep2.address, unit: dep2.unit };
  }
  function poolMatchesApproval(state, approval2) {
    return !!approval2 && ["root", "program", "period", "amount", "domain"].every((key) => state?.[key] === (key === "root" ? approval2.root : approval2.c?.[key]));
  }
  function verifyRewardTransaction(kind, txHash, info, dep2, approval2, decodeState) {
    try {
      if (info?.tx_hash !== txHash || !Number.isInteger(info.block_height) || info.block_height <= 0 || !Array.isArray(info.inputs) || !Array.isArray(info.outputs)) return null;
      const quantity = (entry) => (entry.asset_list || []).filter((a) => a.policy_id + (a.asset_name || "") === dep2.unit).reduce((n, a) => n + BigInt(a.quantity), 0n);
      const poolOutputs = info.outputs.filter((o) => o.payment_addr?.bech32 === dep2.address && quantity(o) === 1n);
      if (poolOutputs.length !== 1) return null;
      const after = decodeState(poolOutputs[0].inline_datum?.bytes);
      if (!poolMatchesApproval(after, approval2) || !Array.isArray(after.used)) return null;
      if (kind === "fund") {
        if (BigInt(poolOutputs[0].value) !== 20000000n || after.used.length !== 0 || !info.inputs.some((i) => i.tx_hash === dep2.seed.txHash && i.tx_index === dep2.seed.outputIndex)) return null;
        if (!info.plutus_contracts?.some((c) => c.valid_contract === true && c.script_hash === dep2.unit.slice(0, 56))) return null;
        return { verified: true };
      }
      if (kind !== "claim") return null;
      const poolInputs = info.inputs.filter((i) => i.payment_addr?.bech32 === dep2.address && quantity(i) === 1n);
      if (poolInputs.length !== 1) return null;
      const before = decodeState(poolInputs[0].inline_datum?.bytes);
      if (!poolMatchesApproval(before, approval2) || !Array.isArray(before.used) || BigInt(poolInputs[0].value) - BigInt(poolOutputs[0].value) !== 2000000n) return null;
      const nullifier = after.used[0];
      if (!canonical(nullifier) || before.used.includes(nullifier) || after.used.length !== before.used.length + 1 || before.used.some((n, i) => after.used[i + 1] !== n) || approval2.nullifier && approval2.nullifier !== nullifier) return null;
      const contract = info.plutus_contracts?.find((c) => c.address === dep2.address && c.valid_contract === true && c.spends_input?.tx_hash === poolInputs[0].tx_hash && c.spends_input?.tx_index === poolInputs[0].tx_index && c.input?.redeemer?.purpose === "spend" && c.input.redeemer.datum?.value?.constructor === 1);
      const recipient = contract?.input.redeemer.datum.value.fields?.[2]?.bytes;
      if (!/^[0-9a-f]{56}$/i.test(recipient || "")) return null;
      const payment = info.outputs.find((o) => o.payment_addr?.cred === recipient && BigInt(o.value) === 2000000n);
      if (!payment) return null;
      return { verified: true, nullifier, recipientAddress: payment.payment_addr.bech32 };
    } catch {
      return null;
    }
  }
  function rewardStatusForReport(reportId, { approval: approval2, submitted: submitted2, chainState: chainState2 } = {}) {
    if (!identifier(reportId) || !approval2 || approval2.reportId !== reportId || !programIdentifier(approval2.programId)) return null;
    const approved = { state: "approved", label: "Approved \xB7 not paid" };
    const expectedNullifier = canonical(approval2.nullifier) ? approval2.nullifier : submitted2?.chainVerified === true && submitted2.source === "cloud" ? submitted2.nullifier : null;
    const matchingClaim = submitted2?.kind === "claim" && submitted2.reportId === reportId && submitted2.programId === approval2.programId && canonical(expectedNullifier) && submitted2.nullifier === expectedNullifier && typeof submitted2.hash === "string" && /^[0-9a-f]{64}$/i.test(submitted2.hash);
    if (!matchingClaim && submitted2?.source === "cloud" && submitted2.kind === "claim" && submitted2.reportId === reportId && submitted2.programId === approval2.programId && /^[0-9a-f]{64}$/i.test(submitted2.hash || "")) return { state: "submitted", label: "Claim reported \xB7 awaiting Preprod verification", txHash: submitted2.hash };
    if (!matchingClaim) return approved;
    const pending2 = { state: "submitted", label: "Claim submitted \xB7 confirmation pending", txHash: submitted2.hash };
    if (submitted2.source === "cloud" && submitted2.chainVerified !== true) return pending2;
    if (submitted2.confirmed !== true || !Array.isArray(chainState2?.used) || !chainState2.used.includes(submitted2.nullifier)) return pending2;
    const expected = { root: approval2.root, program: approval2.c?.program, period: approval2.c?.period, amount: approval2.c?.amount, domain: approval2.c?.domain };
    if (approval2.periodId != null) {
      try {
        if (expected.period !== periodFieldId(approval2.periodId)) return pending2;
      } catch {
        return pending2;
      }
    }
    if (expected.program !== programFieldId(approval2.programId) || expected.amount !== "2000000" || Object.entries(expected).some(([key, value]) => !canonical(value) || chainState2[key] !== value)) return pending2;
    return { state: "confirmed", label: "Paid \xB7 2 test ADA (Preprod)", txHash: submitted2.hash };
  }

  // src/privacy-ui.js
  var secret = null;
  var approval = null;
  var claim = null;
  var busy = false;
  var log = [];
  var publicClaim = null;
  var sdk = null;
  var lucid = null;
  var wallet = null;
  var walletAddress = null;
  var dep = null;
  var pending = null;
  var submitted = null;
  var chainState = null;
  var cloudContext = null;
  var transactions = { fund: null, claim: null };
  var poolBalance = null;
  var archives = [];
  var lastError = false;
  var savedKey = STORAGE_KEY;
  var rewardOwnerId = null;
  var rewardStorageValid = true;
  function clearReportState() {
    approval = null;
    claim = null;
    publicClaim = null;
    dep = null;
    pending = null;
    submitted = null;
    chainState = null;
    cloudContext = null;
    transactions = { fund: null, claim: null };
    poolBalance = null;
    lastError = false;
  }
  function resetRewardState() {
    clearReportState();
    secret = null;
    log = [];
    sdk = null;
    lucid = null;
    wallet = null;
    walletAddress = null;
    archives = [];
    rewardStorageValid = true;
    delete window.careloopCommitment;
  }
  function restoredTransactions(saved) {
    const records = { fund: null, claim: null };
    for (const kind of ["fund", "claim"]) {
      const r = saved.transactions?.[kind] || (saved.submitted?.kind === kind ? saved.submitted : null);
      if (r && /^[0-9a-f]{64}$/i.test(r.hash || "")) records[kind] = { ...r, kind, confirmed: false, chainVerified: false };
    }
    return records;
  }
  function selectSubmitted() {
    submitted = transactions.claim || transactions.fund;
  }
  function restoreSavedReward() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(savedKey) || "null");
      if (!saved) return;
      assertRecoveryNetwork(saved);
      if ((saved.ownerId ?? null) !== rewardOwnerId) throw Error("Reward owner mismatch");
      const restoredCommitment = saved.secret ? commitment(saved.secret) : null;
      ({ secret, approval, dep } = saved);
      transactions = restoredTransactions(saved);
      selectSubmitted();
      cloudContext = saved.cloudContext ? { reportId: saved.cloudContext.reportId, programId: saved.cloudContext.programId, canFund: false } : null;
      archives = Array.isArray(saved.archives) ? saved.archives.filter((a) => typeof a.key === "string" && a.key.startsWith(savedKey + ":archive:")) : [];
      if (restoredCommitment) window.careloopCommitment = restoredCommitment;
    } catch {
      resetRewardState();
      rewardStorageValid = false;
      log.push("Saved reward data could not be restored and has been preserved. Download it before restoring a valid Preprod recovery file.");
    }
  }
  restoreSavedReward();
  var esc = (s) => window.careloopEscape(String(s));
  var recovery = () => ({ network: NETWORK, networkMagic: NETWORK_MAGIC, ownerId: rewardOwnerId, secret, approval, dep, submitted, transactions, cloudContext, archives });
  var persist = () => {
    if (rewardStorageValid) sessionStorage.setItem(savedKey, JSON.stringify(recovery()));
  };
  window.careloopRewardBusy = () => busy;
  window.careloopSetRewardOwner = (ownerId = null) => {
    if (ownerId !== null && (typeof ownerId !== "string" || !ownerId.trim() || ownerId.length > 200 || ownerId.trim() !== ownerId)) throw Error("Invalid reward account.");
    if (ownerId === rewardOwnerId) return;
    if (busy) throw Error("Wait for the current reward action to finish before switching accounts.");
    persist();
    resetRewardState();
    rewardOwnerId = ownerId;
    savedKey = ownerId === null ? STORAGE_KEY : STORAGE_KEY + ":account:" + ownerId;
    restoreSavedReward();
    window.render?.();
  };
  var say = (s) => {
    log.push(s);
    window.render();
  };
  async function run(fn) {
    if (busy) return;
    busy = true;
    lastError = false;
    window.render();
    try {
      await fn();
    } catch (e) {
      lastError = true;
      log.push("Action stopped: " + (e?.message || e?.info || String(e)));
    } finally {
      busy = false;
      persist();
      window.render();
    }
  }
  function wallets() {
    return Object.entries(window.cardano || {}).filter(([, v]) => v && typeof v.enable === "function").map(([id, w]) => ({ id, name: w.name || id }));
  }
  function button(label, fn, disabled = false) {
    return `<button class="btn secondary" onclick="${fn}" ${disabled || busy ? "disabled" : ""}>${label}</button>`;
  }
  var canProve = () => !!secret && !!approval && !cloudContext?.canFund && (!approval.commitment || commitment(secret) === approval.commitment);
  var canFund = () => !!approval && (!cloudContext || cloudContext.canFund === true);
  var signature = (a, c) => JSON.stringify([a?.reportId ?? c?.reportId, a?.programId ?? c?.programId, a?.root, a?.c?.program, a?.c?.period, a?.c?.amount, a?.c?.domain]);
  function archiveCurrent() {
    if (!dep && !submitted) return;
    const key = savedKey + ":archive:" + Date.now() + ":" + crypto.randomUUID();
    sessionStorage.setItem(key, JSON.stringify(recovery()));
    archives = [...archives, { key, reportId: approval?.reportId ?? cloudContext?.reportId ?? null, programId: approval?.programId ?? cloudContext?.programId ?? null, poolAddress: dep?.address ?? null, signature: signature(approval, cloudContext), createdAt: (/* @__PURE__ */ new Date()).toISOString() }];
    persist();
    log.push("Previous pool recovery archived in this tab. Its download remains available below.");
  }
  async function loadDeployment(value) {
    if (!value) return null;
    const publicDep = publicRewardDeployment(value);
    sdk ??= await import("/chain/wallet.js");
    const [bp, vk] = await Promise.all(["/zk/plutus.json", "/zk/verification_key.json"].map(async (url) => {
      const r = await fetch(url);
      if (r.ok === false) throw Error("Unable to load trusted contract files.");
      return r.json();
    }));
    const rebuilt = sdk.deployment(bp, vk, publicDep.seed, publicDep.clinic);
    if (rebuilt.network !== NETWORK || rebuilt.address !== publicDep.address || rebuilt.unit !== publicDep.unit) throw Error("Cloud pool does not match the trusted Preprod contract.");
    return rebuilt;
  }
  function cloudRecord(kind, value, a) {
    if (!value) return null;
    if (!/^[0-9a-f]{64}$/i.test(value.txHash || "")) throw Error("Invalid cloud transaction ID.");
    return { kind, hash: value.txHash, reportId: a.reportId, programId: a.programId, source: "cloud", confirmed: false, chainVerified: false, ...kind === "claim" && a.nullifier ? { nullifier: a.nullifier } : {} };
  }
  window.careloopClearCloudReport = () => {
    if (busy) throw Error("Wait for the current reward action before changing reports.");
    archiveCurrent();
    clearReportState();
    persist();
    window.render?.();
  };
  window.careloopUseCloudReport = async (report, { canFund: funding = false } = {}) => {
    if (busy) throw Error("Wait for the current reward action before changing reports.");
    if (!rewardStorageValid) throw Error("Preserved reward recovery data needs inspection first.");
    if (typeof report?.id !== "string" || !report.id.trim()) throw Error("A saved cloud report is required.");
    programFieldId(report.programId);
    busy = true;
    window.render?.();
    try {
      const next = cloudRewardApproval(report), context = { reportId: report.id, programId: report.programId, canFund: funding === true };
      if (next && !context.canFund && secret && commitment(secret) !== next.commitment) throw Error("This report uses a different enrollment. Restore its private recovery file to claim.");
      if (next) next.nullifier = !context.canFund && secret ? hash(secret, scope(next.c)).toString() : null;
      const same = signature(approval, cloudContext) === signature(next, context);
      let previous = null;
      if (!same) {
        const old = [...archives].reverse().find((a) => a.signature === signature(next, context));
        if (old) {
          previous = assertRecoveryNetwork(JSON.parse(sessionStorage.getItem(old.key) || "null"));
          if ((previous.ownerId ?? null) !== rewardOwnerId) throw Error("Archived pool owner mismatch");
        }
      }
      const base = same ? transactions : previous ? restoredTransactions(previous) : { fund: null, claim: null };
      const cloudDep = report.chain?.fund?.dep ?? report.chain?.claim?.dep;
      if (!next && cloudDep) throw Error("A funded cloud report must include its public approval.");
      let nextDep = cloudDep ? await loadDeployment(cloudDep) : same ? dep : previous?.dep ? await loadDeployment(previous.dep) : null;
      if (report.chain?.fund?.dep && report.chain?.claim?.dep && JSON.stringify(publicRewardDeployment(report.chain.fund.dep)) !== JSON.stringify(publicRewardDeployment(report.chain.claim.dep))) throw Error("Cloud funding and claim refer to different pools.");
      const heldDep = same ? dep : previous?.dep;
      if (heldDep && nextDep && (heldDep.address !== nextDep.address || heldDep.unit !== nextDep.unit)) throw Error("Cloud pool differs from the preserved local pool. Keep its recovery file.");
      const nextRecords = { fund: null, claim: null };
      for (const kind of ["fund", "claim"]) {
        const incoming = next ? cloudRecord(kind, report.chain?.[kind], next) : null;
        nextRecords[kind] = base[kind]?.source === "local" || base[kind] && base[kind].hash === incoming?.hash ? base[kind] : incoming || base[kind];
      }
      if (!same) archiveCurrent();
      if (!same || cloudContext?.canFund !== context.canFund) {
        claim = null;
        publicClaim = null;
        pending = null;
        chainState = null;
        poolBalance = null;
      }
      approval = next;
      cloudContext = context;
      dep = nextDep;
      transactions = nextRecords;
      selectSubmitted();
      lastError = false;
      persist();
      log.push(context.canFund ? "Cloud approval loaded for clinic funding. The patient enrollment secret is not needed." : "Cloud report loaded. Claiming requires its matching private enrollment.");
      return window.careloopChainSnapshot();
    } finally {
      busy = false;
      window.render?.();
    }
  };
  window.careloopReceiverWallets = () => wallets().map((w) => ({ id: w.id, name: w.name }));
  window.careloopReceivingAddress = () => walletAddress;
  window.careloopValidateRecipient = async (value) => {
    const address = String(value || "").trim();
    sdk ??= await import("/chain/wallet.js");
    sdk.paymentKey(address);
    return address;
  };
  window.careloopConnectReceiver = async (index) => {
    if (busy) throw Error("Wait for the current proof or wallet action.");
    const w = wallets()[index];
    if (!w) throw Error("Wallet extension unavailable. Paste a Preprod receiving address.");
    busy = true;
    window.render?.();
    try {
      const api = await window.cardano[w.id].enable();
      if (await api.getNetworkId() !== NETWORK_ID) throw Error("Switch your wallet to Cardano Preprod. Mainnet addresses are not accepted.");
      sdk ??= await import("/chain/wallet.js");
      const reader = await sdk.Lucid(new sdk.Koios(location.origin + "/cardano"), NETWORK);
      reader.selectWallet.fromAPI(api);
      const address = await reader.wallet().address();
      sdk.paymentKey(address);
      wallet = api;
      lucid = reader;
      walletAddress = address;
      return address;
    } finally {
      busy = false;
      window.render?.();
    }
  };
  window.careloopBuildSponsoredProof = async (report, recipientAddress) => {
    if (busy) throw Error("Wait for the current proof or wallet action.");
    if (!rewardStorageValid) throw Error("Restore a valid private enrollment recovery file first.");
    const next = cloudRewardApproval(report);
    if (!next) throw Error("The saved report does not have a reward authorization.");
    if (!secret || commitment(secret) !== next.commitment) throw Error("Restore this enrollment\u2019s private recovery file in My rewards, then retry the live payment.");
    const expected = report.payout?.recipientAddress || report.recipientAddress;
    if (!expected || recipientAddress !== expected) throw Error("The receiving address differs from the submitted report.");
    const owner = rewardOwnerId;
    busy = true;
    window.render?.();
    try {
      sdk ??= await import("/chain/wallet.js");
      const recipient = BigInt("0x" + sdk.paymentKey(recipientAddress)).toString();
      const w = witness(secret, { root: next.root, siblings: next.siblings, directions: next.directions }, recipient, next.c);
      const result = await window.snarkjs.groth16.fullProve(w, "/zk/reward.wasm", "/zk/reward.zkey", null, {}, { singleThread: true });
      const response = await fetch("/zk/verification_key.json");
      if (response.ok === false) throw Error("Could not load the proof verification key.");
      const vk = await response.json();
      if (!await window.snarkjs.groth16.verify(vk, result.publicSignals, result.proof)) throw Error("Private proof verification failed. No claim was sent.");
      if (owner !== rewardOwnerId) throw Error("The account changed while creating the proof.");
      return { proof: result.proof, publicSignals: result.publicSignals };
    } finally {
      busy = false;
      window.render?.();
    }
  };
  window.careloopRewardStatus = (reportId) => rewardStatusForReport(reportId, { approval, submitted: transactions.claim || submitted, chainState });
  window.careloopChainSnapshot = () => {
    const safe = (r) => r ? { txHash: r.hash, confirmed: r.confirmed === true, source: r.source || "local" } : null;
    return { network: NETWORK, networkMagic: NETWORK_MAGIC, busy, walletConnected: !!walletAddress, walletAddress: walletAddress || null, enrollmentCreated: !!secret, enrollmentMatchesApproval: canProve(), approvalReady: !!approval, proofVerified: !!claim, canFund: canFund(), poolConfirmed: !!chainState, poolAddress: dep?.address || null, stateNft: dep?.unit || null, poolBalanceLovelace: poolBalance?.toString() ?? null, poolBalance: poolBalance == null ? null : Number(poolBalance) / 1e6, usedNullifiers: chainState ? [...chainState.used] : [], reportId: approval?.reportId ?? cloudContext?.reportId ?? null, programId: approval?.programId ?? cloudContext?.programId ?? null, approvalPeriodLabel: approval?.periodLabel ?? null, fund: safe(transactions.fund), claim: safe(transactions.claim), submitted: submitted ? { kind: submitted.kind, ...safe(submitted) } : null, rewardStatus: window.careloopRewardStatus(approval?.reportId), cloudSyncPending: Object.values(transactions).some((r) => r?.syncPending), error: lastError ? "The last reward action did not complete. See My rewards for details." : null, archivedPoolCount: archives.length };
  };
  async function saveCloudRecord(record) {
    if (!cloudContext) return;
    record.syncPending = true;
    persist();
    try {
      if (typeof window.careloopSaveChain !== "function") throw Error("Cloud save is unavailable");
      await window.careloopSaveChain(record.reportId, { kind: record.kind, txHash: record.hash, dep: publicRewardDeployment(dep) });
      record.syncPending = false;
      persist();
      log.push("Transaction reference saved to the shared report.");
    } catch {
      log.push("The transaction is retained locally. Its cloud record could not be saved; retry cloud sync without submitting another transaction.");
    }
  }
  window.chainSyncCloud = () => run(async () => {
    for (const record of Object.values(transactions)) if (record?.syncPending) await saveCloudRecord(record);
  });
  window.privacyPanel = () => `<section class="card" style="margin-top:22px"><div class="eyebrow">CARDANO PREPROD \xB7 ON-CHAIN REWARDS</div><h2>Prove approval. Claim test ADA.</h2><p>Real Cardano transactions on <strong>Preprod testnet</strong>. Your wallet signs; this app never receives its seed phrase. Gemini reviews fictional reports; the completion policy authorizes eligible submissions. Clinics resolve holds.</p><div class="steps"><div class="${secret ? "on" : ""}">1. Enrollment</div><div class="${approval ? "on" : ""}">2. Approval & funding</div><div class="${claim ? "on" : ""}">3. ZK proof</div><div class="${window.careloopRewardStatus(approval?.reportId)?.state === "confirmed" ? "on" : ""}">4. On-chain claim</div></div>
<h3>Wallet</h3>${walletAddress ? `<p class="proof-json">Connected: ${esc(walletAddress)}</p>` : `<p>Use a Cardano wallet extension in your browser, switched to Preprod. The ChatGPT browser may not have an extension.</p>`}
<div class="flex" style="flex-wrap:wrap;gap:10px">${wallets().map((w, i) => button("Connect " + esc(w.name), `chainConnect(${i})`)).join("") || '<span class="muted">No wallet extension detected. Open this site in the browser where your Cardano wallet is installed.</span>'}${button("Refresh wallets", "window.render()")}${button("Check Preprod network", "chainCheckNetwork()")}</div>
<p><a href="https://docs.cardano.org/cardano-testnets/tools/faucet/" target="_blank" rel="noopener noreferrer">Get free Preprod test ADA \u2197</a> \xB7 Funding needs a pure-ADA UTxO \u226525 test ADA and separate collateral. Claims need test ADA for fees/collateral. Network reads and submitted transactions go to Koios.</p>
<h3>Enrollment & approval</h3><p>${cloudContext?.canFund ? "Clinic funding uses the patient\u2019s public approval. The patient keeps their own enrollment secret." : secret ? "Enrollment saved in this browser tab. The secret is not sent to Gemini, Koios or the blockchain." : "Create an enrollment before submitting a fictional report, or restore its private recovery file."}</p>
<div class="flex" style="flex-wrap:wrap;gap:10px">${button("Create enrollment", "zkEnroll()", !!secret || !rewardStorageValid || cloudContext?.canFund)}${button("Download recovery file", "zkBackup()", !secret && !dep && !approval && rewardStorageValid)}<label class="btn secondary">Restore recovery file<input type="file" accept="application/json" onchange="zkRestore(this.files[0])" style="max-width:200px" ${busy ? "disabled" : ""}></label></div>
${archives.length ? `<details><summary>Preserved pool recovery files (${archives.length})</summary>${archives.map((a, i) => button("Download " + esc(a.reportId || "previous pool"), `zkBackupArchive(${i})`)).join("")}</details>` : ""}
<p>${approval ? "Approved for " + esc(approval.periodLabel) + (approval.reportId ? " \xB7 Report " + esc(approval.reportId) + " \xB7 Program " + esc(approval.programId) : " \xB7 Legacy approval, not linked to a report") + ". Eight synthetic approvals in this batch. Fixed demo reward: 2 test ADA for this reporting period." : "Awaiting clinic approval."}</p><p class="muted">The connected funding wallet acts as the clinic for this fictional demo. Selecting the Clinic role does not verify clinic membership.</p>
<h3>Reward pool</h3><p>Fund <strong>20 test ADA</strong>: up to eight rewards of 2 test ADA, plus 4 test ADA retained in the contract. This experimental pool has no refund function. Only use disposable test ADA.</p>
<div class="flex" style="flex-wrap:wrap;gap:10px">${button("Prepare 20 ADA pool", "chainFund()", !canFund() || !lucid || !!dep || !!transactions.fund)}${button("Refresh on-chain state", "chainRefresh()", !dep)}${dep && !submitted && !chainState ? button("Discard unsubmitted pool", "chainDiscard()") : ""}</div>
${dep ? `<p class="proof-json">Pool address: ${esc(dep.address)}<br>State NFT: ${esc(dep.unit)}</p><p>${chainState ? "Confirmed pool \xB7 " + chainState.used.length + " claims recorded." : "Pool configuration saved; refresh to check confirmation."}</p>` : ""}
<h3>Private claim</h3><div class="flex" style="flex-wrap:wrap;gap:10px">${button("Generate ZK proof", "zkProve()", !canProve() || !walletAddress)}${button("Prepare 2 ADA claim", "chainClaim()", !canProve() || !claim || !dep || !lucid || !!transactions.claim)}${button("Test changed recipient", "zkTamper()", !claim)}</div><p>Proofs bind the reward to your connected wallet\u2019s payment key. No questionnaire, patient ID, secret or Merkle path is included on-chain. Wallets, fees, timing and amounts remain public.</p>
${publicClaim ? `<details><summary>Inspect public claim</summary><pre class="proof-json">${esc(JSON.stringify(publicClaim, null, 2))}</pre></details>` : ""}
${pending ? `<div class="info"><h3>Review transaction before signing</h3><p>${esc(pending.kind === "fund" ? "Lock 20 test ADA at the pool above; mint one state NFT." : "Pay 2 test ADA from the pool to your connected wallet; record the nullifier.")} Your wallet pays a network fee of approximately ${pending.summary.fee.toFixed(6)} test ADA.</p><p class="proof-json">Transaction ID: ${pending.summary.hash}</p><p>Check the outputs in your wallet. Signing submits this transaction to Preprod.</p>${button("Sign & submit in wallet", "chainSign()")}${button("Cancel prepared transaction", "chainCancel()")}</div>` : ""}
${submitted ? `<p><a target="_blank" rel="noopener noreferrer" href="${EXPLORER}/transaction/${esc(submitted.hash)}">View ${esc(submitted.kind)} transaction \u2197</a> \xB7 ${submitted.confirmed ? "Confirmed on Preprod" : "Submitted; confirmation pending"}</p>` : ""}
${Object.values(transactions).some((r) => r?.syncPending) ? button("Retry cloud record", "chainSyncCloud()") : ""}
<div aria-live="polite">${busy ? '<p class="info">Working\u2026 keep this tab open.</p>' : ""}${log.map((s) => '<div class="audit">' + esc(s) + "</div>").join("")}</div><small>Experimental development proving setup. Use fictional data only. Enrollment recovery files contain your private enrollment secret. Keep them private. Closing this tab can clear its local session.</small></section>`;
  window.zkEnroll = () => {
    if (!rewardStorageValid) throw Error("Existing reward recovery data needs inspection. Download it before restoring a valid Preprod recovery file.");
    if (secret) return;
    secret = randomSecret();
    window.careloopCommitment = commitment(secret);
    persist();
    say("Enrollment created. Download its recovery file before funding.");
  };
  window.zkApprove = (report) => {
    if (!secret) throw Error("Open My rewards and create enrollment first.");
    if (approval) throw Error("A report is already approved in this session.");
    if (typeof report?.id !== "string" || !report.id.trim() || typeof report.period !== "string") throw Error("A saved report and reporting period are required.");
    const programId = report.programId ?? report.program?.id;
    const c = { ...config, program: programFieldId(programId), domain: randomSecret(), period: report.periodId == null ? String(Number(report.period.match(/\d+/)?.[0] || 5)) : periodFieldId(report.periodId) };
    const leaves = Array.from({ length: 8 }, () => leaf(commitment(randomSecret()), c));
    const index = crypto.getRandomValues(new Uint8Array(1))[0] % 8;
    leaves[index] = leaf(window.careloopCommitment, c);
    approval = { ...tree(leaves, index), c, commitment: window.careloopCommitment, reportId: report.id, programId, periodId: report.periodId ?? null, nullifier: hash(secret, scope(c)).toString(), periodLabel: report.period };
    persist();
    log.push("Fictional clinic approval created for report " + report.id + ". Funding transaction will commit this root on-chain.");
  };
  window.chainCheckNetwork = () => run(async () => {
    sdk ??= await import("/chain/wallet.js");
    const params = await new sdk.Koios(location.origin + "/cardano").getProtocolParameters();
    log.push("Preprod connected. Live protocol version " + params.protocolMajorVersion + "; transaction library loaded. Connect a wallet to continue.");
  });
  window.chainConnect = (i) => run(async () => {
    const w = wallets()[i];
    if (!w) throw Error("Wallet unavailable. Refresh wallets.");
    const api = await window.cardano[w.id].enable();
    if (await api.getNetworkId() !== NETWORK_ID) throw Error("Mainnet is blocked. Switch your wallet to Preprod testnet.");
    sdk ??= await import("/chain/wallet.js");
    lucid = await sdk.Lucid(new sdk.Koios(location.origin + "/cardano"), sdk.NETWORK);
    lucid.selectWallet.fromAPI(api);
    await sdk.assertWalletOnTargetNetwork(lucid);
    wallet = api;
    walletAddress = await lucid.wallet().address();
    sdk.paymentKey(walletAddress);
    claim = null;
    publicClaim = null;
    pending = null;
    log.push("Preprod wallet connected; wallet outputs verified on the target network.");
  });
  window.chainFund = () => run(async () => {
    if (!canFund() || !lucid || dep || transactions.fund) throw Error("Load a clinic approval, connect its funding wallet and use a fresh pool.");
    const [blueprint, vk] = await Promise.all(["/zk/plutus.json", "/zk/verification_key.json"].map((u) => fetch(u).then((r) => r.json())));
    const prepared = await sdk.preparePool(lucid, blueprint, vk, { ...approval.c, root: approval.root });
    dep = prepared.dep;
    pending = { tx: prepared.tx, kind: "fund", summary: sdk.transactionSummary(prepared.tx), address: walletAddress, reportId: approval.reportId, programId: approval.programId };
    log.push("Funding transaction prepared, not signed or submitted.");
  });
  window.chainDiscard = () => {
    if (busy) return;
    if (submitted || chainState) {
      say("A submitted pool cannot be discarded. Download its recovery file.");
      return;
    }
    dep = null;
    pending = null;
    persist();
    window.render();
  };
  window.chainCancel = () => {
    if (busy) return;
    if (pending?.kind === "fund") dep = null;
    pending = null;
    persist();
    window.render();
  };
  window.chainSign = () => run(async () => {
    if (!pending) throw Error("Prepare a transaction first.");
    if (await wallet.getNetworkId() !== NETWORK_ID) throw Error("Switch back to Preprod.");
    await sdk.assertWalletOnTargetNetwork(lucid);
    const now = await lucid.wallet().address();
    if (now !== pending.address) throw Error("Wallet account changed. Reconnect and prepare again.");
    const p = pending;
    const signed = await p.tx.sign.withWallet().complete();
    const record = { hash: p.summary.hash, kind: p.kind, reportId: p.reportId, programId: p.programId, confirmed: false, source: "local", submissionStatus: "pending", ...p.kind === "claim" ? { nullifier: p.nullifier } : {} };
    transactions[p.kind] = record;
    selectSubmitted();
    pending = null;
    persist();
    const txHash = await signed.submit();
    if (txHash !== record.hash) throw Error("Unexpected transaction ID. Saved state retained; inspect before retry.");
    record.submissionStatus = "submitted";
    persist();
    log.push("Submitted to Preprod. No confirmation claimed yet; use Refresh on-chain state.");
    await saveCloudRecord(record);
  });
  window.chainRefresh = () => run(async () => {
    if (!dep) throw Error("Load a funded report or prepare a pool first.");
    sdk ??= await import("/chain/wallet.js");
    const reader = lucid ?? await sdk.Lucid(new sdk.Koios(location.origin + "/cardano"), NETWORK);
    chainState = null;
    poolBalance = null;
    for (const r of Object.values(transactions)) if (r) {
      r.confirmed = false;
      r.chainVerified = false;
    }
    const pool = await sdk.readPool(reader, dep);
    if (!poolMatchesApproval(pool.state, approval)) throw Error("The Preprod pool does not match this report approval.");
    chainState = pool.state;
    poolBalance = pool.utxo.assets.lovelace;
    for (const record of Object.values(transactions)) if (record) {
      const status = await reader.transactionStatus(record.hash);
      if (status.status !== "confirmed") continue;
      if (record.source === "cloud") {
        const r = await fetch(location.origin + "/cardano/tx_info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _tx_hashes: [record.hash], _inputs: true, _assets: true, _scripts: true, _bytecode: true }) });
        if (r.ok === false) throw Error("Unable to verify the cloud transaction on Preprod.");
        const rows = await r.json();
        const evidence = verifyRewardTransaction(record.kind, record.hash, Array.isArray(rows) ? rows.find((t) => t.tx_hash === record.hash) : null, dep, approval, sdk.decodeState);
        if (!evidence) {
          log.push("Cloud " + record.kind + " reference is not verified as this pool transaction.");
          continue;
        }
        record.chainVerified = true;
        if (evidence.nullifier) record.nullifier = evidence.nullifier;
      }
      record.confirmed = true;
    }
    selectSubmitted();
    log.push("Read pool from Preprod: " + poolBalance / 1000000n + " test ADA, " + chainState.used.length + " claims.");
  });
  window.zkProve = () => run(async () => {
    if (!canProve() || !walletAddress) throw Error("The matching patient enrollment and recipient wallet are required. Clinic funding cannot use a clinic enrollment secret.");
    const recipient = BigInt("0x" + sdk.paymentKey(walletAddress)).toString();
    const w = witness(secret, { root: approval.root, siblings: approval.siblings, directions: approval.directions }, recipient, approval.c);
    const result = await window.snarkjs.groth16.fullProve(w, "/zk/reward.wasm", "/zk/reward.zkey", null, {}, { singleThread: true });
    const vk = await fetch("/zk/verification_key.json").then((r) => r.json());
    if (!await window.snarkjs.groth16.verify(vk, result.publicSignals, result.proof)) throw Error("Proof verification failed");
    claim = result;
    publicClaim = { ...result, recipient_address: walletAddress, network: NETWORK };
    pending = null;
    log.push("Real proof generated and verified; bound to connected wallet.");
  });
  window.chainClaim = () => run(async () => {
    if (!canProve() || !claim || !dep || !lucid || transactions.claim) throw Error("Use the matching patient proof and funded pool. Refresh any already recorded claim before continuing.");
    const tx = await sdk.prepareClaim(lucid, dep, claim, walletAddress);
    pending = { tx, kind: "claim", summary: sdk.transactionSummary(tx), address: walletAddress, reportId: approval?.reportId ?? null, programId: approval?.programId ?? null, nullifier: claim.publicSignals[1] };
    log.push("Claim passed script evaluation. Review and sign to submit it.");
  });
  window.zkTamper = () => run(async () => {
    if (!claim) return;
    const changed = [...claim.publicSignals];
    changed[5] = (BigInt(changed[5]) + 1n).toString();
    const vk = await fetch("/zk/verification_key.json").then((r) => r.json());
    const ok = await window.snarkjs.groth16.verify(vk, changed, claim.proof);
    log.push(ok ? "ERROR: altered proof accepted." : "Changed recipient rejected by cryptographic verifier.");
  });
  function downloadRecovery(contents, name) {
    if (!contents) throw Error("Recovery file is unavailable.");
    const u = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = u;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1e3);
  }
  window.zkBackup = () => {
    persist();
    downloadRecovery(sessionStorage.getItem(savedKey), "careloop-preprod-private-recovery.json");
  };
  window.zkBackupArchive = (index) => {
    const entry = archives[index];
    if (!entry || !entry.key.startsWith(savedKey + ":archive:")) throw Error("Recovery archive is unavailable for this account.");
    downloadRecovery(sessionStorage.getItem(entry.key), "careloop-preprod-archived-pool-recovery.json");
  };
  window.zkRestore = (file) => run(async () => {
    if (!file) return;
    if (secret || dep) throw Error("Restore into a fresh browser tab before creating an enrollment.");
    if (file.size > 1e5) throw Error("Recovery file too large.");
    const s = assertRecoveryNetwork(JSON.parse(await file.text()));
    const restoredCommitment = s.secret ? commitment(s.secret) : null;
    if (s.approval) {
      if (s.approval.siblings?.length !== 3 || s.approval.directions?.length !== 3) throw Error("Invalid recovery path");
    }
    const restoredDep = s.dep ? await loadDeployment(s.dep) : null;
    secret = s.secret || null;
    approval = s.approval || null;
    transactions = restoredTransactions(s);
    selectSubmitted();
    cloudContext = s.cloudContext ? { reportId: s.cloudContext.reportId, programId: s.cloudContext.programId, canFund: false } : null;
    dep = restoredDep;
    if (restoredCommitment) window.careloopCommitment = restoredCommitment;
    else delete window.careloopCommitment;
    rewardStorageValid = true;
    log.push("Recovery restored. Refresh the Preprod pool before treating any transaction as confirmed.");
  });
})();
