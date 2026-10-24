import { ensureDb } from "./seed";

ensureDb()
  .then(() => {
    console.log("bali-food database initialized and seeded.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
