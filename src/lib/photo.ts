// A dog's photo, picked from the gallery: square, 512 px, JPEG, copied into the
// app's own storage. A camera photo is often 12 MP; shown at ~100 px that only
// wastes memory and space (Play's "bitmap downsampling" advice).
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File, Paths } from "expo-file-system";

const SIZE = 512;

/** Lets the user pick and crop a photo; returns its new file URI, or null if cancelled. */
export async function pickDogPhoto(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (r.canceled || !r.assets[0]) return null;
  const ctx = ImageManipulator.manipulate(r.assets[0].uri);
  ctx.resize({ width: SIZE, height: SIZE });
  const small = await (await ctx.renderAsync()).saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  // Out of the cache, so the photo survives.
  const dest = new File(Paths.document, `dog-${Date.now()}.jpg`);
  await new File(small.uri).copy(dest);
  return dest.uri;
}
