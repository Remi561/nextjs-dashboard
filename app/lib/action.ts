'use server'
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import postgres from 'postgres';
import { redirect } from 'next/navigation';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

const formSchema = z.object({
    id: z.string(),
    customerId: z.string(),
    amount: z.coerce.number(),
    status: z.enum(['paid', 'pending']),
    date: z.string()
})

const createinvoice = formSchema.omit({id: true, date: true});


export async function create(formData: FormData) { 
    const { customerId, amount, status } = createinvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    const amountInCents = Math.round(amount * 100);
    const date = new Date().toISOString().split('T')[0];

    await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

const UpdateInvoice = formSchema.omit({ id: true, date: true });

export async function updateInvoice(id: string, formData: FormData) {
    const {customerId, amount, status,} = UpdateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    const amountInCents = Math.round(amount * 100);

    await sql`
        UPDATE invoices
        SET customer_id = ${customerId},
            amount = ${amountInCents},
            status = ${status}
        WHERE id = ${id}
    `;

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    await sql`
        DELETE FROM invoices
        WHERE id = ${id}
    `;

    revalidatePath('/dashboard/invoices');

}