"use client";

import { createContext, useContext, useState, useEffect } from "react";

type UserData = {
  nimNip: string;
  userName: string;
  userRole: string;
  userEmail: string;
  isLoadingUser: boolean;
  setUserEmail: (email: string) => void;
};

const defaultValue: UserData = {
  nimNip: "",
  userName: "",
  userRole: "",
  userEmail: "",
  isLoadingUser: true,
  setUserEmail: () => {},
};

export const UserContext = createContext<UserData>(defaultValue);

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [nimNip, setNimNip] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.nim_nip) {
          setNimNip(data.nim_nip);
          setUserName(data.nama);
          setUserRole(data.role);
          setUserEmail(data.email || "");
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingUser(false));
  }, []);

  return (
    <UserContext.Provider
      value={{ nimNip, userName, userRole, userEmail, isLoadingUser, setUserEmail }}
    >
      {children}
    </UserContext.Provider>
  );
}
