'use server'
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import postgres from 'postgres';
import { redirect } from 'next/navigation';
import { signIn, signOut } from "@/auth";

import { AuthError } from "next-auth";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

const formSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: "Please select a customer",
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: "please enter amount greater than $0" }),
  status: z.enum(["paid", "pending"], {
    invalid_type_error: "Please select between pending or paid",
  }),
  date: z.string(),
});

const createinvoice = formSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid credentials";
        default:
          return "Something went wrong";
      }
    }
    throw error;
  }
}

export async function signout() {
  await signOut({ redirectTo: "/" });
}

export async function create(prevState: State, formData: FormData) {
  const validatedField = createinvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  console.log(validatedField);
  if (!validatedField.success) {
    return {
      errors: validatedField.error.flatten().fieldErrors,
      message: "Missing field. failed to create invoice",
    };
  }
  const { customerId, amount, status } = validatedField.data;
  const amountInCents = Math.round(amount * 100);
  const date = new Date().toISOString().split("T")[0];

  try {
    await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
  } catch (error) {
    console.error(error);
    return { message: "Database Error: failed to create invoices " };
  }
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

const UpdateInvoice = formSchema.omit({ id: true, date: true });

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
) {
  const validatedField = UpdateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  if (!validatedField.success) {
    return {
      errors: validatedField.error.flatten().fieldErrors,
      message: "Missing field. failed to update invoice",
    };
  }

  const { customerId, amount, status } = validatedField.data;
  const amountInCents = Math.round(amount * 100);

  try {
    await sql`
            UPDATE invoices
            SET customer_id = ${customerId},
                amount = ${amountInCents},
                status = ${status}
            WHERE id = ${id}
        `;
  } catch (error) {
    console.error(error);
    return { message: "Database Error: failed to update invoice " };
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
  await sql`
        DELETE FROM invoices
        WHERE id = ${id}
    `;

  revalidatePath("/dashboard/invoices");
}