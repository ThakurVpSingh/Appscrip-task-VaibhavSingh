import { AccountForm } from "@/components/account-form";

export const metadata = { title: "Create your account" };

export default function RegisterPage() {
  return <AccountForm mode="register" />;
}
