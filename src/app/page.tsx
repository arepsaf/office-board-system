"use client";

import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
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
  const [events, setEvents] = useState<OfficeEvent[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  const [date, setDate] = useState("");
  const [category, setCategory] = useState("EVENT");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);

  async function loadStaff() {
    const { data, error } = await supabase
      .from("staff")
      .select("id, name")
      .eq("active", true)
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setStaff(data || []);
  }

  async function loadEvents() {
    const { data, error } = await supabase
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

    if (error) {
      console.error(error);
      return;
    }

    setEvents((data as OfficeEvent[]) || []);
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();

    if (!date || !title) {
      alert("Date dan Title wajib isi");
      return;
    }

    const { data: newEvent, error } = await supabase
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

    if (error || !newEvent) {
      console.error(error);
      alert("Gagal add event");
      return;
    }

    if (selectedStaff.length > 0) {
      const picRows = selectedStaff.map((staffId) => ({
        event_id: newEvent.id,
        staff_id: staffId,
      }));

      const { error: picError } = await supabase
        .from("event_pics")
        .insert(picRows);

      if (picError) {
        console.error(picError);
        alert("Event masuk, tapi PIC gagal masuk");
      }
    }

    setDate("");
    setCategory("EVENT");
    setTitle("");
    setLocation("");
    setSelectedStaff([]);

    await loadEvents();
  }

  useEffect(() => {
    loadStaff();
    loadEvents();

    const channel = supabase
      .channel("office-board-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          loadEvents();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_pics" },
        () => {
          loadEvents();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
        event.category === "SPORT"
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
        <div className="bg-white rounded-2xl shadow p-6">
          <h1 className="text-3xl font-bold mb-1">Office Board System</h1>
          <p className="text-gray-500">Digital monthly office board</p>
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
            <option>EVENT</option>
            <option>SPORT</option>
            <option>AL</option>
            <option>PUBLIC HOLIDAY</option>
            <option>TRAINING</option>
            <option>MEETING</option>
          </select>

          <input
            type="text"
            placeholder="Title / Program"
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
            plugins={[dayGridPlugin]}
            initialView="dayGridMonth"
            height="auto"
            events={calendarEvents}
            dayMaxEvents={3}
            eventDisplay="block"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,dayGridWeek",
            }}
          />
        </div>
      </div>
    </main>
  );
}
