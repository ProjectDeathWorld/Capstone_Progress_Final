# Student directory import

The student directory is the source of truth for Registrar routing.  Place the supplied
`LOA_100_Student_Test_Data.sql` in this directory's `database/imports/` folder and run it
against the Laravel database after migrations.  The SQL must insert the supplied values into
`students (student_number, student_name, course, registrar_window)`.

For MySQL using this project's local settings:

```powershell
Get-Content database/imports/LOA_100_Student_Test_Data.sql | mysql -u root laravel
```

The repository did not contain either supplied dataset file at implementation time, so no
student records have been fabricated or hardcoded.
