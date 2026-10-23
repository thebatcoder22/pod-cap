import { db } from "@/db";
import { resetToRoster } from "./reset";

export const resetDb = () => resetToRoster(db);
