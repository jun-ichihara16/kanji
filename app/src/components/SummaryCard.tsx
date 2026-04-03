export default function SummaryCard({
  value,
  label,
  color,
}: {
  value: string | number
  label: string
  color?: string
}) {
  return (
    <div className="text-center py-3.5 px-2 bg-gray-bg rounded-xl">
      <div
        className="font-inter text-2xl font-extrabold"
        style={{ color: color || '#1A1A1A' }}
      >
        {value}
      </div>
      <div className="text-[11px] text-sub mt-0.5">{label}</div>
    </div>
  )
}
