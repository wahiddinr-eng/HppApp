import nodemailer from "nodemailer";

export function smtpTransportOptions(env:Record<string,string|undefined>=process.env){
  if(!env.SMTP_HOST)throw new Error("SMTP_NOT_CONFIGURED");
  const port=Number(env.SMTP_PORT||587);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error("SMTP_INVALID_PORT");
  const secure=env.SMTP_SECURE==="true";
  return {
    host:env.SMTP_HOST,port,secure,
    requireTLS:!secure&&(env.SMTP_REQUIRE_TLS==="true"||env.SMTP_HOST==="smtp-relay.brevo.com"),
    auth:env.SMTP_USER?{user:env.SMTP_USER,pass:env.SMTP_PASSWORD}:undefined,
    tls:{minVersion:"TLSv1.2" as const},
    connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,
    logger:false,debug:false
  };
}
export function createSmtpTransport(){return nodemailer.createTransport(smtpTransportOptions());}
