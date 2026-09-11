namespace MathilensERP.Tools.ResetPassword;

internal sealed class CommandLineOptions
{
    public string ConnectionString { get; private init; } = string.Empty;

    public string? Email { get; private init; }

    public string? Password { get; private init; }

    public bool ListOnly { get; private init; }

    public bool SkipConfirmation { get; private init; }

    public bool ShowHelp { get; private init; }

    public static CommandLineOptions Parse(string[] args)
    {
        string? connectionString = Environment.GetEnvironmentVariable("MATHILENS_CONNECTION");
        string? email = null;
        string? password = null;
        var listOnly = false;
        var skipConfirmation = false;

        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--help" or "-h":
                    return new CommandLineOptions { ShowHelp = true };

                case "--connection":
                    connectionString = NextValue(args, ref i, "--connection");
                    break;

                case "--email":
                    email = NextValue(args, ref i, "--email");
                    break;

                case "--password":
                    password = NextValue(args, ref i, "--password");
                    break;

                case "--list":
                    listOnly = true;
                    break;

                case "--yes" or "-y":
                    skipConfirmation = true;
                    break;

                default:
                    throw new CommandLineException($"unrecognised argument '{args[i]}'.");
            }
        }

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new CommandLineException("no connection string. Pass --connection or set MATHILENS_CONNECTION.");
        }

        if (!listOnly && string.IsNullOrWhiteSpace(email))
        {
            throw new CommandLineException("--email is required (or use --list to see the accounts that exist).");
        }

        return new CommandLineOptions
        {
            ConnectionString = connectionString,
            Email = email,
            Password = password,
            ListOnly = listOnly,
            SkipConfirmation = skipConfirmation,
        };
    }

    private static string NextValue(string[] args, ref int index, string optionName)
    {
        if (index + 1 >= args.Length)
        {
            throw new CommandLineException($"{optionName} needs a value.");
        }

        return args[++index];
    }
}

internal sealed class CommandLineException(string message) : Exception(message);
