using System.Text;
using System.Text.Json.Serialization;
using MathilensERP.Api.Common;
using MathilensERP.Api.Common.Authorization;
using MathilensERP.Api.Contracts.Common;
using MathilensERP.Shared.Authorization;
using MathilensERP.Application;
using MathilensERP.Infrastructure;
using MathilensERP.Infrastructure.Identity;
using MathilensERP.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using System.Security.Claims;
using MathilensERP.Application.Common.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Every enum in this API's contracts (OrderStatus, InvoiceStatus, PaymentMethod, etc.)
        // is otherwise serialized as its underlying integer by System.Text.Json's default —
        // fragile for API consumers and undocumented in Swagger. Readable names, matching the
        // C# member names exactly, over the wire in both directions.
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();

// 00_MASTER_SPEC.md § 8.7 — every error response, including framework model-binding
// failures, uses the same envelope as Result-mapped failures.
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var details = context.ModelState
            .Where(entry => entry.Value?.Errors.Count > 0)
            .SelectMany(entry => entry.Value!.Errors.Select(e => new ApiFieldError(entry.Key, e.ErrorMessage)))
            .ToList();

        var body = ApiErrorResponse.From("VALIDATION_ERROR", "One or more fields are invalid.", details);
        return new BadRequestObjectResult(body);
    };
});

builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Mathilens Tailoring ERP API", Version = "v1" });

    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath);
    }

    var bearerScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter a JWT access token issued by POST /api/v1/auth/login.",
    };

    options.AddSecurityDefinition("Bearer", bearerScheme);
    options.AddSecurityRequirement(_ => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", null, null)] = [],
    });
});

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var jwtSection = builder.Configuration.GetSection("Jwt");
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidateAudience = true,
            ValidAudience = jwtSection["Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Convert.FromBase64String(jwtSection["SigningKey"]!)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
        };

        // One signed-in place per account.
        //
        // A valid signature is no longer enough: the token also has to belong to the account's
        // current session. Without this, signing in elsewhere could only revoke the refresh token,
        // and the old screen would carry on working until its access token expired - up to fifteen
        // minutes of two people using one login, which is exactly what the shop asked to prevent.
        //
        // The check is served from an in-process cache written through on every sign-in, so the
        // ordinary request costs no database round trip and the cut-off is still immediate.
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var principal = context.Principal;
                var userIdClaim = principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!Guid.TryParse(userIdClaim, out var userId))
                {
                    return;
                }

                var sessionId = principal?.FindFirstValue(IActiveSessionService.SessionClaimType);
                var sessions = context.HttpContext.RequestServices.GetRequiredService<IActiveSessionService>();

                if (!await sessions.IsCurrentAsync(userId, sessionId, context.HttpContext.RequestAborted))
                {
                    // A distinct reason on the challenge, so the browser can tell "signed in
                    // elsewhere" apart from an ordinary expiry and say so instead of just bouncing
                    // the user to the login screen with no explanation.
                    context.Fail("session_superseded");
                    context.HttpContext.Response.Headers["X-Session-Ended"] = "superseded";
                }
            },
        };
    });

// One policy per permission, generated from the catalogue rather than listed by hand — a new
// permission becomes enforceable the moment it is added to Permissions.All.
// Scoped, not singleton: the handler resolves permissions through IRolePermissionService, which
// reaches the database (via a scoped DbContext) when its cache is cold. Registering the handler as
// a singleton would capture that scoped dependency and fail at the first request.
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddAuthorization(options =>
{
    foreach (var permission in Permissions.All)
    {
        options.AddPolicy(permission, policy => policy.Requirements.Add(new PermissionRequirement(permission)));
    }
});

// The Next.js frontend is a separately deployable application communicating over REST
// (01_ARCHITECTURE.md § 3 AD-007), so it calls the API cross-origin. The allowed origins are
// configuration-driven, not hardcoded, so they differ correctly per environment. Comma-separated
// so a local dev frontend can be allowed alongside the deployed SWA origin without swapping config.
const string FrontendCorsPolicy = "Frontend";
var frontendOrigins = (builder.Configuration["Cors:FrontendOrigin"] ?? string.Empty)
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        if (frontendOrigins.Length > 0)
        {
            // Content-Disposition has to be named explicitly. A browser hands cross-origin
            // JavaScript only the CORS-safelisted response headers unless the server widens that
            // list, and this one is not on it — so the export downloads carried the server's
            // filename in a header the page was not allowed to read. The fallback name took over
            // and every export, of either format, saved as "export.xlsx". A spreadsheet named
            // export.xlsx looks entirely correct, which is why this hid until a PDF came out
            // wearing it.
            policy.WithOrigins(frontendOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .WithExposedHeaders("Content-Disposition");
        }
    });
});

var app = builder.Build();

// Bring the schema up to date before the app serves a single request. Nothing else in the
// pipeline does this: deploy-api.yml publishes and deploys, and migrations were left to whoever
// remembered to run `dotnet ef database update` by hand. They stopped being run, so the API went
// live querying an Orders.Notes column and a ClothPrices table that did not exist in the
// production database — a silent outage that only surfaced when the next release was inspected.
//
// Everywhere except Development, rather than Production specifically: the integration tests boot
// this same host through WebApplicationFactory with no database behind it and pin the environment
// to Development to stay out of this path, while a deployed slot must migrate whether it calls
// itself Production, Staging or nothing at all. Developers keep applying migrations themselves,
// where a failure is cheap to see and undo.
if (!app.Environment.IsDevelopment())
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    // Deliberately unguarded: if this throws, startup fails and the deployment is visibly broken.
    // Serving traffic against a schema the code doesn't match is the worse outcome — that is
    // precisely the failure this block exists to prevent.
    await dbContext.Database.MigrateAsync();

    // Roles are reference data the authorization model depends on, so they are created here
    // rather than left to a manual step someone has to remember on a fresh database.
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
    foreach (var role in AppRoles.All)
    {
        if (!await roleManager.RoleExistsAsync(role))
        {
            await roleManager.CreateAsync(new ApplicationRole { Name = role });
        }
    }

    // One-time backfill for databases created before permissions existed. Every endpoint used to be
    // plain [Authorize], so an authenticated user could already do everything; now that the same
    // endpoints demand a permission, a user carrying no role would be locked out of the system the
    // moment this version starts — including the shop owner, with nobody left able to grant access.
    // Making those pre-existing users Owner preserves exactly the access they already had rather
    // than granting anything new, and they can be demoted from the Users screen afterwards.
    //
    // Guarded on *no user holding any role at all*, which is precisely the upgrading-from-the-old-world
    // state and can never be true again once this has run. That matters: a role-less user created
    // later is someone an Owner has not yet given access to, and they must stay locked out rather
    // than be quietly promoted by the next restart.
    if (!await dbContext.UserRoles.AnyAsync())
    {
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        foreach (var user in await dbContext.Users.ToListAsync())
        {
            await userManager.AddToRoleAsync(user, AppRoles.Owner);
        }
    }
}

// Configure the HTTP request pipeline.
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors(FrontendCorsPolicy);

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

/// <summary>Entry point, exposed for <c>WebApplicationFactory&lt;Program&gt;</c> in integration tests.</summary>
public partial class Program
{
}
