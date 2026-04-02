interface IconProps {
  className?: string
}

export function PinIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M7 3.5H13L11.8 7.4L14.7 10.3V11.3H10.8V16.5L9.2 15.1V11.3H5.3V10.3L8.2 7.4L7 3.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function EditIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M13.9 3.6A1.5 1.5 0 0 1 16 5.7L7.4 14.3L4 15.1L4.8 11.7L13.9 3.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12.5 5L14.6 7.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
