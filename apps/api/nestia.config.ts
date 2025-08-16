import { INestiaConfig } from "@nestia/sdk";

const config: INestiaConfig = {
  input: "./src/**/*.controller.ts",
  output: "../../packages/sdk/src",
  json: true,
  primitive: false,
  propagate: true,
  e2e: "./test/e2e",
};
export default config;