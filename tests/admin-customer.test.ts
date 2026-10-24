import assert from "node:assert/strict";
import test from "node:test";
import { adminCustomerSchema } from "../src/server/admin-customer";

const input = {id:"customer-1",name:"  Ibu Sari  ",email:"  SARI@Example.COM  ",phone:"0812-3456-7890",reason:"Customer salah ketik"};

test("admin customer editor normalizes login email and Indonesian phone", () => {
  const result = adminCustomerSchema.parse(input);
  assert.equal(result.name,"Ibu Sari");
  assert.equal(result.email,"sari@example.com");
  assert.equal(result.phone,"+6281234567890");
  assert.equal(adminCustomerSchema.parse({...input,phone:""}).phone,"");
});

test("admin customer editor rejects invalid contact and missing audit reason", () => {
  assert.equal(adminCustomerSchema.safeParse({...input,email:"not-email"}).success,false);
  assert.equal(adminCustomerSchema.safeParse({...input,phone:"12345"}).success,false);
  assert.equal(adminCustomerSchema.safeParse({...input,name:"S\nari"}).success,false);
  assert.equal(adminCustomerSchema.safeParse({...input,reason:"ok"}).success,false);
});
