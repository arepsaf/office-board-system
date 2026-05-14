"use client";

import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { supabase } from "@/lib/supabase";

type Staff = {
  id: string;
  name: string;
};

type OfficeEvent = {
  id: string;
  date: string;
  category: string;
  title: string;
  location: string | null;
  status: string;
  event_pics?: {
    staff: Staff;
  }[];
};

export default function Home() {
  const [session, setSession] = useState<any>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [events, setEvents] = useState<OfficeEvent[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  const [date, setDate] = useState("");
  const [category, setCategory] = useState("EVENT");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);

  const [selectedEvent, setSelectedEvent] = useState<OfficeEvent | null>(null);

  async function login(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function loadStaff() {
    const { data } = await supabase
      .from("staff")
      .select("id, name")
      .eq("active", true)
      .order("name");

    setStaff(data || []);
  }

  async function loadEvents() {
    const { data } = await supabase
      .from("events")
      .select(
        `
        *,
        event_pics (
          staff (
            id,
            name
          )
        )
      `,
      )
      .neq("status", "Cancelled")
      .order("date", { ascending: true });

    setEvents((data as OfficeEvent[]) || []);
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();

    const { data: newEvent } = await supabase
      .from("events")
      .insert({
        date,
        category,
        title,
        location,
        status: "Active",
      })
      .select()
      .single();

    if (!newEvent) return;

    if (selectedStaff.length > 0) {
      const picRows = selectedStaff.map((staffId) => ({
        event_id: newEvent.id,
        staff_id: staffId,
      }));

      await supabase.from("event_pics").insert(picRows);
    }

    setDate("");
    setCategory("EVENT");
    setTitle("");
    setLocation("");
    setSelectedStaff([]);

    await loadEvents();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("events").update({ status }).eq("id", id);

    setSelectedEvent(null);
    await loadEvents();
  }

  async function deleteEvent(id: string) {
    const confirmDelete = confirm("Delete event?");
    if (!confirmDelete) return;

    await supabase.from("events").delete().eq("id", id);

    setSelectedEvent(null);
    await loadEvents();
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    loadStaff();
    loadEvents();

    const channel = supabase
      .channel("office-board-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => loadEvents(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_pics" },
        () => loadEvents(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <form
          onSubmit={login}
          className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md space-y-4"
        >
          <h1 className="text-3xl font-bold text-center">Office Board Login</h1>

          <input
            type="email"
            placeholder="Email"
            className="w-full border rounded-xl px-4 py-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full border rounded-xl px-4 py-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            className="w-full bg-black text-white rounded-xl px-4 py-3 font-semibold"
          >
            Login
          </button>
        </form>
      </main>
    );
  }

  const calendarEvents = events.map((event) => {
    const picNames =
      event.event_pics?.map((pic) => pic.staff.name).join(", ") || "";

    return {
      id: event.id,
      title: `${event.category} | ${event.title}${
        picNames ? ` (${picNames})` : ""
      }`,
      date: event.date,
      backgroundColor:
        event.status === "Done"
          ? "#16a34a"
          : event.category === "SPORT"
            ? "#7c3aed"
            : event.category === "EVENT"
              ? "#2563eb"
              : event.category === "AL"
                ? "#dc2626"
                : event.category === "PUBLIC HOLIDAY"
                  ? "#ef4444"
                  : "#0f766e",
      borderColor: "transparent",
    };
  });

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow p-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Office Board System</h1>
            <p className="text-gray-500">Logged in as {session.user.email}</p>
          </div>

          <button
            onClick={logout}
            className="bg-red-600 text-white rounded-xl px-4 py-3"
          >
            Logout
          </button>
        </div>

        <form
          onSubmit={addEvent}
          className="bg-white rounded-2xl shadow p-6 grid grid-cols-1 md:grid-cols-6 gap-4"
        >
          <input
            type="date"
            className="border rounded-xl px-4 py-3"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <select
            className="border rounded-xl px-4 py-3"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>TRAINING</option>
            <option>ANNUAL LEAVE</option>
            <option>EVENT</option>
            <option>GAJI</option>
            <option>SPORT</option>
            <option>MEETING</option>
            <option>BOOTH</option>
            <option>REMINDER</option>
            <option>PUBLIC HOLIDAY</option>
            <option>HARI RAYA</option>
            <option>GAWAI</option>
            <option>KRISMAS</option>
            <option>NEW YEAR</option>
            <option>3H</option>
            <option>SEWAAN</option>
            <option>JEMPUTAN</option>
            <option>LAWATAN</option>
            <option>PROGRAM</option>
          </select>

          <input
            type="text"
            placeholder="Title"
            className="border rounded-xl px-4 py-3"
            value={title}
            onChange={(e) => setTitle(e.target.value.toUpperCase())}
          />

          <input
            type="text"
            placeholder="Location"
            className="border rounded-xl px-4 py-3"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />

          <select
            multiple
            className="border rounded-xl px-4 py-3 h-28"
            value={selectedStaff}
            onChange={(e) =>
              setSelectedStaff(
                Array.from(e.target.selectedOptions, (option) => option.value),
              )
            }
          >
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="bg-black text-white rounded-xl px-4 py-3 font-semibold"
          >
            Add Event
          </button>
        </form>

        <div className="bg-white rounded-2xl shadow p-6">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height="auto"
            contentHeight={1100}
            expandRows={true}
            events={calendarEvents}
            dayMaxEvents={false}
            eventDisplay="block"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,dayGridWeek",
            }}
            eventClick={(info) => {
              const event = events.find((item) => item.id === info.event.id);
              if (event) setSelectedEvent(event);
            }}
          />
        </div>
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <div>
              <h2 className="text-2xl font-bold">{selectedEvent.title}</h2>
              <p className="text-gray-500">{selectedEvent.category}</p>
            </div>

            <div className="space-y-2 text-sm">
              <p>
                <b>Date:</b> {selectedEvent.date}
              </p>
              <p>
                <b>Location:</b> {selectedEvent.location || "-"}
              </p>
              <p>
                <b>Status:</b> {selectedEvent.status}
              </p>
              <p>
                <b>PIC:</b>{" "}
                {selectedEvent.event_pics
                  ?.map((pic) => pic.staff.name)
                  .join(", ") || "-"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => updateStatus(selectedEvent.id, "Done")}
                className="bg-green-600 text-white rounded-xl px-4 py-3"
              >
                Mark Done
              </button>

              <button
                onClick={() => updateStatus(selectedEvent.id, "Cancelled")}
                className="bg-orange-500 text-white rounded-xl px-4 py-3"
              >
                Cancel
              </button>

              <button
                onClick={() => deleteEvent(selectedEvent.id)}
                className="bg-red-600 text-white rounded-xl px-4 py-3"
              >
                Delete
              </button>

              <button
                onClick={() => setSelectedEvent(null)}
                className="bg-gray-200 rounded-xl px-4 py-3"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
