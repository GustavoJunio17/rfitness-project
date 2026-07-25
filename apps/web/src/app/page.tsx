import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default function RootPage() {
  const hasSession = cookies().has("rf_session");
  redirect(hasSession ? "/dashboard" : "/login");
}
