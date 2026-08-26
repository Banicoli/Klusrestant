import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const { image } = await request.json();
    if (!image) return NextResponse.json({ error: 'Geen afbeelding ontvangen.' }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY ontbreekt.' }, { status: 500 });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-5.6-luna',
      input: [{ role: 'user', content: [
        { type: 'input_text', text: `Je bent Scrappy, een assistent voor een Nederlandse marktplaats voor herbruikbare bouwmaterialen. Analyseer deze foto. Bepaal scan_type als precision voor losse materialen of pile voor een gemengde stapel. Bij precision: materiaal, categorie, aantal, geschatte lengte/breedte/dikte in mm en conditie. Geef geen schijnprecisie: afmetingen zijn schattingen tenzij een betrouwbare referentie zichtbaar is. Bij pile: belangrijkste materialen, percentages en transportgrootte. Geef uitsluitend geldig JSON volgens dit schema: {"scan_type":"precision|pile","objects":[{"material":"","category":"","quantity":0,"length_mm":null,"width_mm":null,"thickness_mm":null,"condition":"","confidence":0}],"materials":[{"material":"","percentage":0}],"transport_size":"kofferbak|aanhanger|bestelbus|grote partij","overall_confidence":0,"uncertainties":[]}` },
        { type: 'input_image', image_url: image }
      ] }],
      text: { format: { type: 'json_object' } }
    });
    return NextResponse.json(JSON.parse(response.output_text));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Analyse mislukt.' }, { status: 500 });
  }
}