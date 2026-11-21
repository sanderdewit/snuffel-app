// Edit a dog's profile, from Edit on its page (src/app/dog/[id].tsx): the same form
// and checks as adding a dog, saved with Done. Delete (with a confirmation) is at the
// bottom; after it the list of dogs shows again.
import { useEffect } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useI18n } from "../../../i18n";
import { DogForm } from "../../../ui/DogForm";

export default function EditDog() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dogId = Number(id);
  const valid = Number.isInteger(dogId) && dogId > 0;
  useEffect(() => { if (!valid && router.canGoBack()) router.back(); }, [valid]);
  if (!valid) return null;   // never the "add a dog" form by accident
  return (
    <>
      <Stack.Screen options={{ title: t("app_editDog") }} />
      {/* After Delete: past this form and the dog's page (dismiss stops at the first screen) */}
      <DogForm dogId={dogId} onSaved={() => router.back()} onDeleted={() => router.dismiss(2)} />
    </>
  );
}
