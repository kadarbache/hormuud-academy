-- Every phone number becomes digits only, country code and all, the way
-- WhatsApp takes one: "252611111111". Numbers were typed in whichever way
-- suited the person at the counter, so each of those ways is recognised:
--
--   00252611111111  the international prefix dialled out loud
--   252611111111    already right
--   0611111111      the way it is dialled inside the country
--   611111111       written without the trunk zero
--
-- Anything that isn't a Somali mobile is left exactly as it was, to be looked
-- at by hand rather than guessed at.

UPDATE "students"
SET "phone" = CASE
    WHEN regexp_replace("phone", '\D', '', 'g') ~ '^00252[0-9]{9}$'
      THEN substring(regexp_replace("phone", '\D', '', 'g') FROM 3)
    WHEN regexp_replace("phone", '\D', '', 'g') ~ '^252[0-9]{9}$'
      THEN regexp_replace("phone", '\D', '', 'g')
    WHEN regexp_replace("phone", '\D', '', 'g') ~ '^0[0-9]{9}$'
      THEN '252' || substring(regexp_replace("phone", '\D', '', 'g') FROM 2)
    WHEN regexp_replace("phone", '\D', '', 'g') ~ '^[0-9]{9}$'
      THEN '252' || regexp_replace("phone", '\D', '', 'g')
    ELSE "phone"
  END
WHERE "phone" IS NOT NULL;

UPDATE "students"
SET "responsiblePhone" = CASE
    WHEN regexp_replace("responsiblePhone", '\D', '', 'g') ~ '^00252[0-9]{9}$'
      THEN substring(regexp_replace("responsiblePhone", '\D', '', 'g') FROM 3)
    WHEN regexp_replace("responsiblePhone", '\D', '', 'g') ~ '^252[0-9]{9}$'
      THEN regexp_replace("responsiblePhone", '\D', '', 'g')
    WHEN regexp_replace("responsiblePhone", '\D', '', 'g') ~ '^0[0-9]{9}$'
      THEN '252' || substring(regexp_replace("responsiblePhone", '\D', '', 'g') FROM 2)
    WHEN regexp_replace("responsiblePhone", '\D', '', 'g') ~ '^[0-9]{9}$'
      THEN '252' || regexp_replace("responsiblePhone", '\D', '', 'g')
    ELSE "responsiblePhone"
  END
WHERE "responsiblePhone" IS NOT NULL;

UPDATE "teachers"
SET "phone" = CASE
    WHEN regexp_replace("phone", '\D', '', 'g') ~ '^00252[0-9]{9}$'
      THEN substring(regexp_replace("phone", '\D', '', 'g') FROM 3)
    WHEN regexp_replace("phone", '\D', '', 'g') ~ '^252[0-9]{9}$'
      THEN regexp_replace("phone", '\D', '', 'g')
    WHEN regexp_replace("phone", '\D', '', 'g') ~ '^0[0-9]{9}$'
      THEN '252' || substring(regexp_replace("phone", '\D', '', 'g') FROM 2)
    WHEN regexp_replace("phone", '\D', '', 'g') ~ '^[0-9]{9}$'
      THEN '252' || regexp_replace("phone", '\D', '', 'g')
    ELSE "phone"
  END
WHERE "phone" IS NOT NULL;

UPDATE "branches"
SET "phone" = CASE
    WHEN regexp_replace("phone", '\D', '', 'g') ~ '^00252[0-9]{9}$'
      THEN substring(regexp_replace("phone", '\D', '', 'g') FROM 3)
    WHEN regexp_replace("phone", '\D', '', 'g') ~ '^252[0-9]{9}$'
      THEN regexp_replace("phone", '\D', '', 'g')
    WHEN regexp_replace("phone", '\D', '', 'g') ~ '^0[0-9]{9}$'
      THEN '252' || substring(regexp_replace("phone", '\D', '', 'g') FROM 2)
    WHEN regexp_replace("phone", '\D', '', 'g') ~ '^[0-9]{9}$'
      THEN '252' || regexp_replace("phone", '\D', '', 'g')
    ELSE "phone"
  END
WHERE "phone" IS NOT NULL;
