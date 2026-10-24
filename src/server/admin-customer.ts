import { randomUUID } from "node:crypto";
import { z } from "zod";
import { transaction } from "./db";
import { enqueueEmail } from "./email";
import { DomainError } from "./http";

export const adminCustomerSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().trim().min(2).max(120)
    .refine(value => !/\p{Cc}/u.test(value), "Nama tidak boleh berisi karakter kontrol."),
  email: z.string().trim().pipe(z.email().max(254)).transform(value => value.toLowerCase()),
  phone: z.string().trim().max(30)
    .transform(value => value.replace(/[\s().-]/g, ""))
    .refine(value => value === "" || /^(?:\+62|62|0)8[0-9]{8,11}$/.test(value), "Gunakan nomor HP Indonesia, misalnya 081234567890.")
    .transform(value => value ? `+62${value.replace(/^(?:\+62|62|0)/, "")}` : ""),
  reason: z.string().trim().min(5).max(500),
});

type CustomerInput = z.infer<typeof adminCustomerSchema>;

export async function updateAdminCustomer(input: CustomerInput, actorId: string) {
  try {
    return await transaction(async client => {
      // Checkout and webhook provisioning use the same email lock.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`email:${input.email}`]);
      const result = await client.query<{email:string;name:string;display_name:string;phone:string|null;role:string;account_status:string}>(
        'SELECT u.email,u.name,p.display_name,p.phone,p.role,p.account_status FROM "user" u JOIN user_profile p ON p.user_id=u.id WHERE u.id=$1 FOR UPDATE OF u,p', [input.id]);
      const customer = result.rows[0];
      if (!customer || customer.role !== "user") throw new DomainError(404, "CUSTOMER_NOT_FOUND", "Akun customer tidak ditemukan.");
      const emailChanged = customer.email.toLowerCase() !== input.email;
      if (emailChanged) {
        const duplicate = await client.query('SELECT 1 FROM "user" WHERE lower(email)=$1 AND id<>$2 LIMIT 1', [input.email,input.id]);
        if (duplicate.rowCount) throw new DomainError(409, "EMAIL_IN_USE", "Email sudah digunakan akun lain.");
      }
      const nameChanged = customer.name !== input.name || customer.display_name !== input.name;
      const phoneChanged = (customer.phone ?? "") !== input.phone;
      if (!emailChanged && !nameChanged && !phoneChanged) throw new DomainError(422, "CUSTOMER_UNCHANGED", "Tidak ada detail yang berubah.");
      if (emailChanged) {
        await client.query('UPDATE "user" SET email=$2,name=$3,"emailVerified"=false,"updatedAt"=now() WHERE id=$1', [input.id,input.email,input.name]);
      } else if (nameChanged) {
        await client.query('UPDATE "user" SET name=$2,"updatedAt"=now() WHERE id=$1', [input.id,input.name]);
      }
      await client.query("UPDATE user_profile SET display_name=$2,phone=$3,updated_at=now() WHERE user_id=$1", [input.id,input.name,input.phone]);
      if (emailChanged) {
        // Old reset/activation URLs must not grant access to the corrected account.
        await client.query('DELETE FROM "verification" WHERE value=$1 AND identifier LIKE $2', [input.id,"reset-password:%"]);
        await client.query("UPDATE account_token SET revoked_at=now() WHERE user_id=$1 AND kind IN ('activation','password_reset') AND consumed_at IS NULL AND revoked_at IS NULL", [input.id]);
        await client.query("UPDATE email_outbox SET status='cancelled',payload=NULL WHERE user_id=$1 AND kind IN ('activation_request','activation','password_reset','access_given') AND status IN ('pending','failed')", [input.id]);
        await client.query('DELETE FROM "session" WHERE "userId"=$1', [input.id]);
        if (customer.account_status === "pending_activation") {
          await enqueueEmail("activation_request",input.id,input.email,new URL("/activate",process.env.APP_BASE_URL).toString(),
            `admin-contact:${input.id}:${randomUUID()}`,client);
        }
      }
      const fields = [nameChanged&&"name",emailChanged&&"email",phoneChanged&&"phone"].filter(Boolean).join(",");
      await client.query("INSERT INTO audit_log(actor_id,action,target,reason) VALUES($1,'edit_customer',$2,$3)",
        [actorId,input.id,`${input.reason} [${fields}]`]);
      return {message:emailChanged
        ? customer.account_status === "pending_activation"
          ? "Detail tersimpan. Tautan lama dibatalkan, sesi dikeluarkan, dan email aktivasi baru dijadwalkan."
          : "Detail tersimpan. Tautan lama dibatalkan dan customer perlu masuk ulang dengan email baru."
        : "Detail pengguna tersimpan dan dicatat dalam audit."};
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505")
      throw new DomainError(409, "EMAIL_IN_USE", "Email sudah digunakan akun lain.");
    throw error;
  }
}
