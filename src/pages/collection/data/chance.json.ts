import { works } from '../../../lib/catalog';
import { withBase } from '../../../lib/urls';
import { v3WorkRoute } from '../../../lib/v3';

export function GET() {
  return Response.json(works.map(work => withBase(v3WorkRoute(work))));
}
