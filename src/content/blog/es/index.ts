// Spanish blog posts
// To add a new post:
// 1. Create a new .ts file in this folder
// 2. Export a `post` object of type BlogPost
// 3. Import it here and add it to `posts`

import { post as post1 } from "./como-organizar-presupuesto-familiar";
import { post as post2 } from "./control-financiero-para-parejas";
import { post as post3 } from "./fondo-de-emergencia-guia";

export const posts = [post1, post2, post3];

