export type Message = {
  id: string;
  role: "user" | "bot" | "mahasiswa" | "dosen" | string;
  content: string;
};

export type Ticket = {
  id: string;
  nama: string;
  nim: string;
  subject: string;
  description?: string;
  status: "Open" | "In Progress" | "Closed";
  date: string;
  nama_layanan?: string;
  updated_at?: string | null;
  unread_count?: number;
};

export type ChatSession = {
  sessionId: string;
  title: string;
};
