// One target for the patient reward pool and the existing Masumi registration.
export const NETWORK = 'Preprod';
export const NETWORK_ID = 0;
export const NETWORK_MAGIC = 1;
export const KOIOS = 'https://preprod.koios.rest/api/v1';
export const EXPLORER = 'https://preprod.cardanoscan.io';
export const STORAGE_KEY = 'careloop-preprod-v1';

export function assertRecoveryNetwork(saved) {
  if (saved?.network !== NETWORK || saved?.networkMagic !== NETWORK_MAGIC) {
    throw Error('This recovery file is not a Cardano Preprod enrollment. Preview and unlabelled legacy files cannot be restored here. Keep the original file and create a new Preprod enrollment.');
  }
  return saved;
}
