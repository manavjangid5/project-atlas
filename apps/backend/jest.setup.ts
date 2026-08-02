import dotenv from "dotenv";
const result = dotenv.config();
console.log("jest.setup.ts loaded, error:", result.error, "JWT_SECRET present:", !!process.env.JWT_SECRET);
console.log("cwd:", process.cwd());