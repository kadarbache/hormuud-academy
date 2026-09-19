# One college with branches, not a system for many colleges

We considered building this as a product that many colleges could use, and treating each branch as its own separate college. We decided on one college, with branches inside it: the college's owner needs totals across branches, and a student or teacher who works at two branches must stay one record. So there is no college ID on any table, and every branch-level record carries a branch instead. Turning this into a multi-college product later means adding a college ID to every table and every query.
