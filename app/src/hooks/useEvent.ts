import { supabase } from '../lib/supabase'
import { nanoid } from 'nanoid'

export interface Event {
  id: string
  slug: string
  host_id: string
  title: string
  venue_name: string | null
  venue_address: string | null
  event_date: string | null
  fee_per_person: number | null
  memo: string | null
  line_group_id: string | null
  reminder_enabled: boolean
  reminder_time: string | null
  created_at: string
}

export interface Participant {
  id: string
  event_id: string
  name: string
  payment_method: string
  paypay_phone: string | null
  is_paid: boolean
  created_at: string
}

export interface SettlementRecord {
  id: string
  event_id: string
  from_name: string
  to_name: string
  amount: number
  is_settled: boolean
  created_at: string
}

export interface AdvanceRecord {
  id: string
  event_id: string
  payer_name: string
  amount: number
  description: string | null
  split_target: string
  target_names: string[] | null
  created_at: string
}

// Admin操作用: Edge Function経由でservice keyを使う
async function callAdminApi(body: Record<string, unknown>) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const res = await fetch(`${supabaseUrl}/functions/v1/admin-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

export function useEvent() {
  async function fetchMyEvents(userId: string) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('host_id', userId)
      .order('created_at', { ascending: false })
    return { data: data as Event[] | null, error }
  }

  async function fetchEventBySlug(slug: string) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .single()
    return { data: data as Event | null, error }
  }

  async function fetchEventById(id: string) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single()
    return { data: data as Event | null, error }
  }

  async function createEvent(hostId: string, eventData: {
    title: string
    venue_name?: string
    venue_address?: string
    event_date?: string
    fee_per_person?: number
    memo?: string
  }) {
    const slug = nanoid(12)
    const { data, error } = await supabase
      .from('events')
      .insert({
        slug,
        host_id: hostId,
        ...eventData,
      })
      .select()
      .single()
    return { data: data as Event | null, error }
  }

  async function deleteEvent(id: string) {
    const { error } = await supabase.from('events').delete().eq('id', id)
    return { error }
  }

  async function updateEvent(id: string, data: { title?: string; event_date?: string; venue_name?: string; status?: string }) {
    const { error } = await supabase.from('events').update(data).eq('id', id)
    return { error }
  }

  async function fetchParticipants(eventId: string) {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
    return { data: data as Participant[] | null, error }
  }

  async function addParticipant(eventId: string, participant: {
    name: string
    payment_method: string
    paypay_phone?: string
  }) {
    const { data, error } = await supabase
      .from('participants')
      .insert({ event_id: eventId, ...participant })
      .select()
      .single()
    return { data: data as Participant | null, error }
  }

  async function updateParticipantName(id: string, name: string) {
    const { error } = await supabase
      .from('participants')
      .update({ name })
      .eq('id', id)
    return { error }
  }

  async function deleteParticipant(id: string) {
    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('id', id)
    return { error }
  }

  async function togglePaid(id: string, isPaid: boolean) {
    const { error } = await supabase
      .from('participants')
      .update({ is_paid: isPaid })
      .eq('id', id)
    return { error }
  }

  async function fetchAdvances(eventId: string) {
    const { data, error } = await supabase
      .from('advances')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
    return { data: data as AdvanceRecord[] | null, error }
  }

  async function fetchAdvancesByEventIds(eventIds: string[]) {
    if (eventIds.length === 0) return { data: [] as AdvanceRecord[], error: null }
    const { data, error } = await supabase
      .from('advances')
      .select('*')
      .in('event_id', eventIds)
    return { data: data as AdvanceRecord[] | null, error }
  }

  async function addAdvance(eventId: string, advance: {
    payer_name: string
    amount: number
    description?: string
    split_target: string
    target_names?: string[]
  }) {
    const { data, error } = await supabase
      .from('advances')
      .insert({ event_id: eventId, ...advance })
      .select()
      .single()
    return { data: data as AdvanceRecord | null, error }
  }

  async function deleteAdvance(id: string) {
    const { error } = await supabase.from('advances').delete().eq('id', id)
    return { error }
  }

  // === Reminder ===
  async function updateReminderSettings(eventId: string, enabled: boolean, time: string) {
    const { error } = await supabase
      .from('events')
      .update({ reminder_enabled: enabled, reminder_time: time })
      .eq('id', eventId)
    return { error }
  }

  async function sendGroupReminder(eventId: string, userId?: string) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const res = await fetch(`${supabaseUrl}/functions/v1/send-group-reminder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ eventId, userId }),
    })
    const data = await res.json()
    return { ok: res.ok, data }
  }

  // === Settlements ===
  async function fetchSettlements(eventId: string) {
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .eq('event_id', eventId)
    return { data: data as SettlementRecord[] | null, error }
  }

  async function upsertSettlement(eventId: string, fromName: string, toName: string, amount: number, isSettled: boolean) {
    const { data, error } = await supabase
      .from('settlements')
      .upsert({
        event_id: eventId,
        from_name: fromName,
        to_name: toName,
        amount,
        is_settled: isSettled,
      }, { onConflict: 'event_id,from_name,to_name' })
      .select()
      .single()
    return { data: data as SettlementRecord | null, error }
  }

  return {
    fetchMyEvents,
    fetchEventBySlug,
    fetchEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    fetchParticipants,
    addParticipant,
    updateParticipantName,
    deleteParticipant,
    togglePaid,
    fetchAdvances,
    fetchAdvancesByEventIds,
    addAdvance,
    deleteAdvance,
    fetchSettlements,
    upsertSettlement,
    updateReminderSettings,
    sendGroupReminder,
    // Admin APIs — RLS制限される操作はEdge Function(service key)経由
    fetchAllUsers: async () => supabase.from('users').select('*').order('created_at', { ascending: false }),
    fetchAllEvents: async () => supabase.from('events').select('*').order('created_at', { ascending: false }),
    fetchAllAdvances: async () => supabase.from('advances').select('*'),
    fetchAllParticipants: async () => supabase.from('participants').select('*'),
    // contacts: RLS強化後はanon keyでSELECT不可 → Edge Function経由
    fetchAllContacts: async (userId: string) => {
      const res = await callAdminApi({ action: 'fetchContacts', userId })
      return { data: res?.data || null, error: res?.error ? { message: res.error } : null }
    },
    banUser: async (userId: string, targetId: string, banned: boolean) => callAdminApi({ action: 'banUser', userId, targetId, banned }),
    updateUserAdminInfo: async (userId: string, targetId: string, tags: string[], memo: string) => callAdminApi({ action: 'updateUserAdminInfo', userId, targetId, tags, memo }),
    updateContactStatus: async (userId: string, contactId: string, status: string) => callAdminApi({ action: 'updateContactStatus', userId, contactId, status }),
    replyContact: async (userId: string, contactId: string, replyText: string) => callAdminApi({ action: 'replyContact', userId, contactId, replyText }),
    forceDeleteEvent: async (userId: string, eventId: string) => callAdminApi({ action: 'forceDeleteEvent', userId, eventId }),
    // Admin APIs (Venues)
    fetchAllVenues: async () => supabase.from('venues').select('*').order('created_at', { ascending: false }),
    createVenue: async (data: any) => supabase.from('venues').insert(data).select().single(),
    updateVenue: async (id: string, data: any) => supabase.from('venues').update(data).eq('id', id).select().single(),
    deleteVenue: async (id: string) => supabase.from('venues').delete().eq('id', id),
  }
}
