import {defineConfig} from "@playwright/test";
const origin="http://127.0.0.1:3027";
const configured=Boolean(process.env.HPP_TEST_DATABASE_URL);
process.env.APP_BASE_URL=origin;
process.env.AUTH_SECRET="local-browser-test-secret-at-least-32-characters";
process.env.DATABASE_URL=process.env.HPP_TEST_DATABASE_URL||"";
process.env.PURCHASE_SOURCE_ID="browser-test";
process.env.ELIGIBLE_AI_FOOD_PRODUCT_IDS="ai-food";
process.env.PURCHASE_WEBHOOK_KEYS=JSON.stringify({test:{source:"browser-test",secret:"browser-test-webhook-secret-32-characters"}});
export default defineConfig({
  testDir:"./tests/e2e",workers:1,timeout:60000,retries:0,
  use:{baseURL:origin,headless:true,trace:"retain-on-failure",
    launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}
  },
  ...(configured?{webServer:{command:"npm run start -- --hostname 127.0.0.1 --port 3027",url:origin+"/login",reuseExistingServer:false,timeout:60000}}:{})
});
