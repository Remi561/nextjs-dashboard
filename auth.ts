import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import z from "zod";
import type { User } from "./app/lib/definitions";
import bcrypt from 'bcrypt'
import postgres from "postgres";
import { emit } from "process";

const sql = postgres(process.env.POSTRES_URL!, { ssl: 'require' })

async function getuser(email: string): Promise<User | undefined>{
    try {
        const user = await sql<User[]> `SELECT * FROM users WHERE email=${email}`
        return user[0]
    }
    catch (error) {
        console.error('Failed to fetch user: ', error)
        throw new Error ("Failed to fetch user")
    }
}


export const { auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCred = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);
                
                if (parsedCred.success) {
                    const { email, password } = parsedCred.data;
                    const user = await getuser(email)
                    if (!user) return null
                    
                    const matchPasswords = await bcrypt.compare(password, user.password)
                    
                    if (matchPasswords) return user

                }
                console.log('Invalid credentials')
                return null
            }
        })
    ]
});