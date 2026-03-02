// ─── pt-BR Blog Posts ──────────────────────────────────────────────────────
// To add a new post:
// 1. Create a new .ts file in this folder (copy one of the existing ones as template)
// 2. Export a `post` object of type BlogPost
// 3. Import it here and add it to the `posts` array below

import { post as post1 } from "./como-organizar-orcamento-familiar";
import { post as post2 } from "./controle-gastos-casal";
import { post as post3 } from "./reserva-de-emergencia";

export const posts = [post1, post2, post3];
