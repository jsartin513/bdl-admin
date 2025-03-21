
import NextAuth from "next-auth"
import GoogleProviders from "next-auth/providers/google"
 
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GoogleProviders]
})