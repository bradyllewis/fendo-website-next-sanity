export default function FormInput({
  id,
  name,
  type = 'text',
  label,
  placeholder,
  defaultValue,
  required = false,
  autoComplete,
  error,
  disabled,
  readOnly,
}: {
  id: string
  name: string
  type?: string
  label: string
  placeholder?: string
  defaultValue?: string
  required?: boolean
  autoComplete?: string
  error?: string
  disabled?: boolean
  readOnly?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-fg mb-1.5">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        readOnly={readOnly}
        className={`w-full bg-bg border rounded-xl px-4 py-3 text-sm transition-colors
          placeholder:text-muted-2 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
          ${error ? 'border-danger' : 'border-border'}
          ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
      {error && (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      )}
    </div>
  )
}
