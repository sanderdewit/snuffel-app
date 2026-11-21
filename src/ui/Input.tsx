// A TextInput in the app's colours: the placeholder and (iOS) the keyboard follow
// light or dark. Style it as before (S.input); every other prop passes through.
import { TextInput, type TextInputProps } from "react-native";
import { useTheme } from "./theme";

export function Input(props: TextInputProps) {
  const { scheme, C } = useTheme();
  return <TextInput placeholderTextColor={C.muted} keyboardAppearance={scheme} {...props} />;
}
