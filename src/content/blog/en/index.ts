// ─── English Blog Posts ────────────────────────────────────────────────────
// To add a new post:
// 1. Create a new .ts file in this folder (copy one of the existing ones as template)
// 2. Export a `post` object of type BlogPost
// 3. Import it here and add it to the `posts` array below

import { post as post1 } from "./how-to-organize-family-budget";
import { post as post2 } from "./emergency-fund-guide";
import { post as post3 } from "./couples-expense-control";

export const posts = [post1, post2, post3];
