import { Controller, type Control } from "@ahmad231/react-formkit";

interface ProfileForm {
  name: string;
  country: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function Select({ value, onChange, onBlur }: SelectProps) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}>
      <option value="us">United States</option>
      <option value="de">Germany</option>
      <option value="jp">Japan</option>
    </select>
  );
}

export default function ProfileForm({ control }: { control: Control<ProfileForm> }) {
  return (
    <Controller
      control={control}
      name="country"
      render={({ field, fieldState }) => (
        <>
          <Select value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
          {fieldState.error && <p>{fieldState.error.message}</p>}
        </>
      )}
    />
  );
}
