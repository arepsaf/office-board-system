"use client";

import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { supabase } from "@/lib/supabase";

type OfficeEvent = {
  id: string;
  date: string;
  category: string;
  title: string;
  status: string;
  event_pics?: {
    staff: {
      name: string;
    };
  }[];
};

export default function TVPage() {
  const [events, setEvents] = useState<OfficeEvent[]>([]);

  async function loadEvents() {
    const { data } = await supabase
      .from("events")
      .select(
        `
        *,
        event_pics (
          staff (
            name
          )
        )
      `,
      )
      .neq("status", "Cancelled")
      .order("date", { ascending: true });

    setEvents((data as OfficeEvent[]) || []);
  }

  useEffect(() => {
    loadEvents();

    const channel = supabase
      .channel("tv-realtime")
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
    <main className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-bold">OFFICE BOARD</h1>

            <p className="text-gray-400 text-xl">Digital Monthly Calendar</p>
          </div>

          <div className="text-right">
            <p className="text-2xl font-semibold">
              {new Date().toLocaleDateString("en-GB")}
            </p>
          </div>
        </div>

        <div className="bg-white text-black rounded-3xl shadow-2xl p-6">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height="auto"
            contentHeight={950}
            expandRows={true}
            events={calendarEvents}
            dayMaxEvents={false}
            eventDisplay="block"
            headerToolbar={{
              left: "",
              center: "title",
              right: "",
            }}
          />
        </div>
      </div>
    </main>
  );
}
