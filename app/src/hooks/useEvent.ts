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
    const slug = nanoid(6)
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

  return {
    fetchMyEvents,
    fetchEventBySlug,
    fetchEventById,
    createEvent,
    fetchParticipants,
    addParticipant,
    togglePaid,
    fetchAdvances,
    addAdvance,
    deleteAdvance,
  }
}
