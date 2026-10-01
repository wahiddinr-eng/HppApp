import test from "node:test";
import assert from "node:assert/strict";
import {smtpTransportOptions} from "../src/server/smtp";
test("Brevo 587 uses required STARTTLS and SMTP key without debug logging",()=>{
  const options=smtpTransportOptions({SMTP_HOST:"smtp-relay.brevo.com",SMTP_PORT:"587",SMTP_USER:"smtp-user@example.test",SMTP_PASSWORD:"dummy-smtp-key",SMTP_SECURE:"false",SMTP_REQUIRE_TLS:"false"});
  assert.equal(options.secure,false);assert.equal(options.requireTLS,true);assert.equal(options.tls.minVersion,"TLSv1.2");assert.equal(options.auth!.pass,"dummy-smtp-key");assert.equal(options.logger,false);assert.equal(options.debug,false);
});
test("Immediate TLS on 465 and local SMTP tests remain supported",()=>{
  assert.equal(smtpTransportOptions({SMTP_HOST:"smtp.example.test",SMTP_PORT:"465",SMTP_SECURE:"true"}).secure,true);
  assert.equal(smtpTransportOptions({SMTP_HOST:"127.0.0.1",SMTP_PORT:"2525"}).requireTLS,false);
  assert.throws(()=>smtpTransportOptions({SMTP_HOST:"smtp.example.test",SMTP_PORT:"not-a-port"}),/SMTP_INVALID_PORT/);
});
