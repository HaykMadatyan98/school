"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MenuItem } from "@/lib/api";

const MenuContext = createContext<MenuItem[]>([]);

export function MenuProvider({
  children,
  initialMenu,
}: {
  children: ReactNode;
  initialMenu: MenuItem[];
}) {
  return (
    <MenuContext.Provider value={initialMenu}>{children}</MenuContext.Provider>
  );
}

export function useMenu() {
  return useContext(MenuContext);
}
