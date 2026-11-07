import { worldPayloadJson } from '../../lib/world-payload';

export const GET = () => new Response(worldPayloadJson, {
  headers: {'Content-Type':'application/json; charset=utf-8'},
});
