import { getCollection, type CollectionEntry } from 'astro:content';
import { islanders, type IslanderId } from './islanders';

export type Exhibition = CollectionEntry<'exhibitions'>;
export type Photograph = CollectionEntry<'photographs'>;

export type ExhibitionPhoto = Photograph & {
  islanderDialogue: Record<IslanderId, string>;
};

const islanderIds = Object.keys(islanders) as IslanderId[];

function assertIslander(id: string, context: string): asserts id is IslanderId {
  if (!(id in islanders)) throw new Error(`Unknown islander \"${id}\" in ${context}.`);
}

function validatePhoto(photo: Photograph, exhibitionId: string): ExhibitionPhoto {
  const dialogue = {} as Record<IslanderId, string>;
  for (const islanderId of islanderIds) {
    const line = photo.data.dialogue[islanderId];
    if (!line) throw new Error(`Photo \"${photo.id}\" is missing dialogue for ${islanderId}.`);
    dialogue[islanderId] = line;
  }

  for (const pair of photo.data.pairDialogue) {
    const [first, second] = pair.islanders;
    assertIslander(first, `pair dialogue in ${photo.id}`);
    assertIslander(second, `pair dialogue in ${photo.id}`);
    if (first === second) throw new Error(`Pair dialogue in ${photo.id} must use two different islanders.`);
    for (const line of pair.lines) assertIslander(line.speaker, `pair dialogue in ${photo.id}`);
  }

  if (photo.data.exhibition !== exhibitionId) {
    throw new Error(`Photo \"${photo.id}\" does not belong to exhibition \"${exhibitionId}\".`);
  }

  return { ...photo, islanderDialogue: dialogue };
}

export async function getPublishedExhibitions() {
  const exhibitions = await getCollection('exhibitions', ({ data }) => !data.draft);
  return exhibitions.sort((left, right) => right.data.publishDate.valueOf() - left.data.publishDate.valueOf());
}

export async function getFeaturedExhibition() {
  const exhibitions = await getPublishedExhibitions();
  return exhibitions.find((exhibition) => exhibition.data.featured) ?? exhibitions[0];
}

export async function getExhibitionById(id: string) {
  const exhibitions = await getPublishedExhibitions();
  return exhibitions.find((exhibition) => exhibition.id === id);
}

export async function getExhibitionPhotos(exhibitionId: string): Promise<ExhibitionPhoto[]> {
  const photos = await getCollection('photographs', ({ data }) => data.exhibition === exhibitionId);
  const orderedPhotos = photos
    .sort((left, right) => left.data.order - right.data.order)
    .map((photo) => validatePhoto(photo, exhibitionId));

  if (orderedPhotos.length < 8 || orderedPhotos.length > 12) {
    throw new Error(`Exhibition \"${exhibitionId}\" must contain 8–12 photographs; found ${orderedPhotos.length}.`);
  }

  orderedPhotos.forEach((photo, index) => {
    if (photo.data.order !== index + 1) {
      throw new Error(`Exhibition \"${exhibitionId}\" has non-continuous photograph order.`);
    }
  });

  return orderedPhotos;
}

export function getPairDialogue(photo: ExhibitionPhoto, selectedIslanders: readonly IslanderId[]) {
  if (selectedIslanders.length !== 2) return [];
  const selected = new Set(selectedIslanders);
  return photo.data.pairDialogue.find((pair) => (
    pair.islanders.length === selected.size && pair.islanders.every((id) => selected.has(id as IslanderId))
  ))?.lines ?? [];
}
