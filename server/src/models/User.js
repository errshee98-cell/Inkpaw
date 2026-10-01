import mongoose from 'mongoose';

/**
 * The server never sees the user's password or their data key.
 *  - authHash:   bcrypt(authKey), where authKey = PBKDF2(password, salt|"auth") computed in the browser
 *  - wrappedKey: the user's random AES-256 data key, encrypted in the browser with
 *                KEK = PBKDF2(password, salt|"enc"). Useless without the password.
 */
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, trim: true, maxlength: 40 },
    authHash: { type: String, required: true, select: false },
    kdf: {
      salt: { type: String, required: true }, // base64
      iterations: { type: Number, default: 310000 },
      algo: { type: String, default: 'PBKDF2-SHA256' },
    },
    wrappedKey: { type: String, required: true }, // base64 ciphertext
    wrapIv: { type: String, required: true }, // base64
    settings: {
      theme: { type: String, default: 'parchment' },
      font: { type: String, default: 'serif' },
      petName: { type: String, default: 'Mochi', maxlength: 20 },
      petSpecies: { type: String, default: 'cat' },
    },
    pet: {
      xp: { type: Number, default: 0 },
      hunger: { type: Number, default: 70 }, // 0-100, "fed" by writing
      lastFedAt: { type: Date, default: Date.now },
    },
    failedLogins: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    email: this.email,
    displayName: this.displayName,
    settings: this.settings,
    pet: this.pet,
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
