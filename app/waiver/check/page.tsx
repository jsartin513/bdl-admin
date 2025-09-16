import React from "react";
import { auth } from "@/auth";
import WaiverCheckClient from "./WaiverCheckClient";

export default async function WaiverCheckPage() {
  const session = await auth();
  
  return <WaiverCheckClient session={session} />;
}
